const responseBuilder = require("aws-lambda-response-builder")
const ytdl = require("ytdl-core")
const fs = require('fs')
const AWS = require('aws-sdk')
const { accessKeyId, secretAccessKey, bucket } = process.env
const S3 = new AWS.S3({
    s3ForcePathStyle: true,
    accessKeyId,
    secretAccessKey
})
const { Buffer } = require('node:buffer')
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)

async function generateVideo(url, title) {
    return await new Promise(async (resolve) => {
        const dir = `/tmp/videos/${title}.mp4`
        const S3Url = `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(title).replaceAll('%20', '+')}.mp4`
        if(!fs.existsSync(`/tmp/videos/`)) fs.mkdirSync(`/tmp/videos/`)
        try {
            // check if video already exists in S3
            const S3ObjectData = await new Promise((resolve) => {
                S3.getObject({
                    Bucket: bucket,
                    Key: `${title}.mp4`
                }, (err, data) => {
                    console.log(err, data)
                    if (data) resolve(data)
                    resolve()
                })
            })
            if (S3ObjectData) {
                if (S3ObjectData?.ContentLength < 16777216 && S3ObjectData?.ContentLength > 0) {
                    console.log('video exists in s3')
                    resolve({
                        mediaResponse: true,
                        S3Url
                    })
                } else if (S3ObjectData?.ContentLength >= 16777216) {
                    console.log('video exists in s3')
                    resolve({
                        mediaResponse: false,
                        S3Url
                    })
                }
            }

            // generate video if it doesn't exist in S3
            console.log('video doesn\'t exist in s3')
            const writter = fs.createWriteStream(dir)
            const streamYtb = ytdl(url, { filter: 'videoandaudio' }).pipe(writter)
            await new Promise((resolve) => {
                streamYtb.on('finish', async () => {
                    const fileStream = fs.createReadStream(dir)
                    await new Promise((resolve) => {
                        S3.putObject({
                            Bucket: bucket,
                            Key: `${title}.mp4`,
                            Body: fileStream,
                            ContentType: 'video/mp4'
                        }, (err, data) => {
                            console.log(err, data)
                            resolve()
                        })
                    })
                    resolve()
                    fs.rmSync(dir)
                })
            })

            resolve({
                mediaResponse: false,
                S3Url
            })
        } catch (err) {
            console.log(err)
        }
    })
}

exports.handler = async (event, context) => {
    console.log(event, context)
    let response = responseBuilder.buildApiGatewayOkResponse('no video pass with ?v=youtube_link')
    response.headers['Content-Type'] = 'plain/text'

    if (event.httpMethod === 'GET') {
        try {
            const videoLink = event.queryStringParameters?.v
            if (videoLink) {
                const isTrustedLink = ytdl.validateURL(videoLink)
                if (isTrustedLink) {
                    const data = await ytdl.getInfo(videoLink)
                    const title = data.videoDetails.title
                    const link = await generateVideo(videoLink, title)
                    response = responseBuilder.buildApiGatewayOkResponse(link.S3Url)
                    return response
                }
            }
            return response
        } catch(e) {
            console.log(e)
            return response
        }
    } else if (event.httpMethod === 'POST') {
        if (event?.body && event?.isBase64Encoded === true) {
            let bodyContent = `${Buffer.from(event.body, 'base64').toString('utf8')}`
            bodyContent = new URLSearchParams(bodyContent)
            console.log('twilio body content ', bodyContent)
            const videoLink = bodyContent.get('Body')
            try {
                if (videoLink) {
                    const isTrustedLink = ytdl.validateURL(videoLink)
                    if (isTrustedLink) {
                        const fromNumber = bodyContent.get('From')
                        const toNumber = bodyContent.get('To')
                        const data = await ytdl.getInfo(videoLink)
                        const title = data.videoDetails.title
                        const link = await generateVideo(videoLink, title)
                        response = responseBuilder.buildApiGatewayOkResponse()
                        response.headers['Content-Type'] = 'text/plain'
                        try {
                            if (link.mediaResponse === true) {
                                const message = await client.messages.create({
                                    from: toNumber,
                                    mediaUrl: [link.S3Url],
                                    to: fromNumber
                                })
                                console.log(message)
                            } else {
                                const message = await client.messages.create({
                                    from: toNumber,
                                    body: link.S3Url,
                                    to: fromNumber
                                })
                                console.log(message)
                            }
                        } catch(e) {
                            console.log(e)
                        }
                        return response
                    }
                }
                return response
            } catch(e) {
                console.log(e)
                return response
            }
        }
    }

    return response
}