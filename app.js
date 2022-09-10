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
        const dir = `${__dirname}/videos/${title}.mp4`
        try {
            await new Promise((resolve, reject) => {
                fs.stat(dir, (err, stats) => {
                    console.log(err, stats)
                    if (stats)
                        return reject('file already exists')
                    return resolve('ok')
                })
            })
            const writter = fs.createWriteStream(dir)
            const streamYtb = ytdl(url).pipe(writter)
            await new Promise((resolve, reject) => {
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
                })
            })
            resolve()
        } catch (err) {
            const fileStream = fs.createReadStream(dir)
            console.log(fileStream)
            await new Promise((resolve) => {
                S3.putObject({
                    Bucket: bucket,
                    Key: `${title}-4.mp4`,
                    Body: fileStream,
                    ContentType: 'video/mp4'
                }, (err, data) => {
                    console.log(err, data)
                    resolve()
                })
            })
            return reject(err)
        }
    })
}

exports.handler = async (event, context) => {
    const response = responseBuilder.buildApiGatewayOkResponse({ message: "ok" })
    const videoLink = event.queryStringParameters?.v
    if (videoLink) {
        const isTrustedLink = ytdl.validateURL(videoLink)
        if (isTrustedLink) {
            const data = await ytdl.getInfo(videoLink)
            const title = data.videoDetails.title
            await generateVideo(videoLink, title)
        }
    }

    return response
}