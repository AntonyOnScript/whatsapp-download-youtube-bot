
const fs = require('fs')
const AWS = require('aws-sdk')
const ytdl = require('ytdl-core')
let { accessKeyId, secretAccessKey, bucket } = process.env
const { IS_OFFLINE } = process.env
let S3 = undefined
const s3Options = {
    s3ForcePathStyle: true,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
}

if (IS_OFFLINE) {
    bucket = 'local-bucket'
    accessKeyId = secretAccessKey = 'S3RVER'
    s3Options.credentials = {
        accessKeyId,
        secretAccessKey
    }
    s3Options['endpoint'] = new AWS.Endpoint('http://localhost:3003')
}

S3 = new AWS.S3(s3Options)

exports.generateVideo = async (url, title) => {
    title = title.normalize()
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
                    if (data) return resolve(data)
                    return resolve()
                })
            })
            if (S3ObjectData) {
                if (S3ObjectData?.ContentLength < 16777216 && S3ObjectData?.ContentLength > 0) {
                    console.log('video exists in s3')
                    return resolve({
                        mediaResponse: true,
                        S3Url
                    })
                } else if (S3ObjectData?.ContentLength >= 16777216) {
                    console.log('video exists in s3')
                    return resolve({
                        mediaResponse: false,
                        S3Url
                    })
                }
            }

            // generate video if it doesn't exist in S3
            console.log('video doesn\'t exist in s3')
            const writter = fs.createWriteStream(dir)
            console.log('start video download')
            const streamYtb = ytdl(url, { filter: 'videoandaudio' }).pipe(writter)
            const linkObject = await new Promise((resolve) => {
                streamYtb.on('finish', async () => {
                    console.log('finished video download')
                    const fileStream = fs.createReadStream(dir)
                    await new Promise((resolve) => {
                        S3.putObject({
                            Bucket: bucket,
                            Key: `${title}.mp4`,
                            Body: fileStream,
                            ContentType: 'video/mp4'
                        }, (err, data) => {
                            console.log(err, data)
                            return resolve()
                        })
                    })
                    const fileSize = fs.statSync(dir).size
                    console.log(`file size ${fileSize}`)
                    fs.rmSync(dir)
                    if (fileSize < 16777216) {
                        return resolve({
                            mediaResponse: true,
                            S3Url
                        })
                    }
                    return resolve({
                        mediaResponse: false,
                        S3Url
                    })
                })
            })

            return resolve(linkObject)
        } catch (err) {
            console.log(err)
        }
    })
}