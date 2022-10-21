const { generateVideo } = require('./generateVideo')
const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken, IS_OFFLINE } = process.env
const { Buffer } = require('node:buffer')
const responseBuilder = require('aws-lambda-response-builder')
const client = require('twilio')(accountSid, authToken)
const ytdl = require('ytdl-core')

exports.messageHandler = async (event, response) => {
    let bodyContent = new URLSearchParams(`${Buffer.from(event.body, 'base64').toString('utf8')}`)
    let videoLink = bodyContent.get('Body')

    if (IS_OFFLINE) {
        // Set local info to test
        bodyContent = new URLSearchParams(`SmsMessageSid=SM228f33dac0b77a31d396aeb4267ad6db&NumMedia=0&ProfileName=Antony&SmsSid=SM228f33dac0b77a31d396aeb4267ad6db&WaId=558491130479&SmsStatus=received&Body=a&To=whatsapp%3A%2B14155238886&NumSegments=1&ReferralNumMedia=0&MessageSid=SM228f33dac0b77a31d396aeb4267ad6db&AccountSid=AC2df3dbbf09e19217e7996e72b7e9db13&From=whatsapp%3A%2B558491130479&ApiVersion=2010-04-01`)
        videoLink = 'https://www.youtube.com/watch?v=XWsptjpzBW0' // Custom local video
    }

    console.log('twilio body content ', bodyContent, videoLink)
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