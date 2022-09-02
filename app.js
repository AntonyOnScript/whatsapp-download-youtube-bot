const responseBuilder = require("aws-lambda-response-builder")
const fs = require('fs')
const youtubedl = require('youtube-dl')

exports.handler = async (event, context) => {
    const response = responseBuilder.buildApiGatewayOkResponse()
    console.log(JSON.stringify(event))
    console.log(JSON.stringify(context))

    if (event.httpMethod === "GET") {
        if (event.queryStringParameters?.ytbUrl) {
            const video = youtubedl(event.queryStringParameters?.ytbUrl,
            // Optional arguments passed to youtube-dl.
            ['--format=18'],
            // Additional options can be given for calling `child_process.execFile()`.
            { cwd: __dirname })
            console.log(video)
            // Will be called when the download starts.
            video.on('info', function(info) {
                console.log(info)
                console.log('Download started')
                console.log('filename: ' + info._filename)
                console.log('size: ' + info.size)
            })

            // video.pipe(fs.createWriteStream('myvideo.mp4'))
        }
    }
    return response
}