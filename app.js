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

async function generateVideo(url, title) {
    return await new Promise(async (resolve, reject) => {
        const dir = `/tmp/videos/${title}.mp4`
        const S3Url = `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(title).replaceAll('%20', '+')}.mp4`
        if(!fs.existsSync(`/tmp/videos/`)) fs.mkdirSync(`/tmp/videos/`)
        try {
            await new Promise((resolve, reject) => {
                fs.stat(dir, (err, stats) => {
                    console.log(err, stats)
                    if (stats)
                        return reject('file already exists')
                    return resolve('ok')
                })
            })
            
            try {
                await new Promise((resolve, reject) => {
                    S3.getObject({
                        Bucket: bucket,
                        Key: `${title}.mp4`
                    }, (err, data) => {
                        console.log(err, data)
                        if (err) resolve()
                        if (data) reject(S3Url) 
                    })
                })
            } catch(e) {
                throw new Error(e)
            }
            
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
            resolve(S3Url)
        } catch (err) {
            console.log(err)
            return reject(err.message)
        }
    })
}

exports.handler = async (event, context) => {
    const videoLink = event.queryStringParameters?.v
    let response = {}
    if (videoLink) {
        const isTrustedLink = ytdl.validateURL(videoLink)
        if (isTrustedLink) {
            const data = await ytdl.getInfo(videoLink)
            const title = data.videoDetails.title
            const link = await generateVideo(videoLink, title)
            response = responseBuilder.buildApiGatewayOkResponse({ message: link })
        }
    }

    return response
}