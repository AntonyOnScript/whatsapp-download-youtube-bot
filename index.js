const responseBuilder = require('aws-lambda-response-builder')
const { messageHandler } = require('./src/functions/messageHandler')

exports.handler = async (event, context) => {
    console.log(event, context)
    let response = responseBuilder.buildApiGatewayOkResponse('You must pass video info in request body')

    if (event.requestContext.http.method === 'POST') {
        if (event?.body) {
            await messageHandler(event, response)
        }
    }

    return response
}