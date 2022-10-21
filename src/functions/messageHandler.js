const { generateVideo } = require('./generateVideo')
const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = process.env
const client = require('twilio')(accountSid, authToken)
const ytdl = require('ytdl-core')
const { Buffer } = require('node:buffer')

exports.messageHandler = async (event, response) => {
    let bodyContent = `${Buffer.from(event.body, 'base64').toString('utf8')}`
    bodyContent = new URLSearchParams(bodyContent)
    console.log('twilio body content ', bodyContent)
    const videoLink = bodyContent.get('Body')
    try {
        if (videoLink) {
            console.log('before validate url')
            const isTrustedLink = ytdl.validateURL(videoLink)
            if (isTrustedLink) {
                const fromNumber = bodyContent.get('From')
                const toNumber = bodyContent.get('To')
                await client.messages.create({
                    from: toNumber,
                    body: 'Baixando seu vídeo...',
                    to: fromNumber
                })
                console.log('before get info')
                const data = await ytdl.getInfo(videoLink)
                console.log(data)
                const title = data.videoDetails.title
                const link = await generateVideo(videoLink, title)
                response = responseBuilder.buildApiGatewayOkResponse()
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