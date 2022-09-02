const responseBuilder = require("aws-lambda-response-builder")
const okResponse = responseBuilder.buildApiGatewayOkResponse({
    message: "some message"
}) 

exports.handler = (req, res) => {
    console.log(req)
    return okResponse
}