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
    return await new Promise(async (resolve) => {
        console.log(0)
        const dir = `/tmp/videos/${title}.mp4`
        const S3Url = `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(title).replaceAll('%20', '+')}.mp4`
        if(!fs.existsSync(`/tmp/videos/`)) fs.mkdirSync(`/tmp/videos/`)
        console.log(1)
        try {
            console.log(2)
            await new Promise((resolve, reject) => {
                fs.stat(dir, (err, stats) => {
                    console.log(err, stats)
                    if (stats)
                        return reject('file already exists')
                    return resolve('ok')
                })
            })
            console.log(3)
            
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
            console.log(4)
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
            console.log(5)
            resolve(S3Url)
        } catch (err) {
            console.log(6)
            console.log(err)
            resolve(err.message)
        }
    })
}

exports.handler = async (event) => {
    let response = responseBuilder.buildApiGatewayOkResponse({ message: 'no video pass with ?v=youtube_link' })
    try {
        const videoLink = event.queryStringParameters?.v
        console.log('video link', videoLink, event)
        if (videoLink) {
            const isTrustedLink = ytdl.validateURL(videoLink)
            console.log('is link ', isTrustedLink)
            if (isTrustedLink) {
                console.log('a')
                console.log(ytdl)
                const data = await ytdl.getInfo(videoLink)
                console.log('b')
                const title = data.videoDetails.title
                console.log('c')
                const link = await generateVideo(videoLink, title)
                console.log('d')
                response = responseBuilder.buildApiGatewayOkResponse({ message: link })
                console.log('response video link ', response)
                console.log(7)
                return response
            }
        }
        console.log('response no video link ', response)
        console.log(8)
        return response
    } catch(e) {
        console.log(e)
        return response
    }
}