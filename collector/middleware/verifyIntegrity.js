const { CommunicationKey } = require("../utils/comKey");

function verifyPayloadIntegrity(request, response, next) {
  const comKey = new CommunicationKey();
  
  if (process.env.NODE_ENV === "development") {
    comKey.log('verifyPayloadIntegrity is skipped in development.')
    next();
    return;
  }

  const signature = request.header("X-Integrity");
  if (!signature) {
    comKey.log('Missing X-Integrity header', {
      headers: request.headers,
      body: request.body
    });
    return response.status(400).json({ 
      msg: 'Failed integrity signature check - missing X-Integrity header' 
    });
  }

  try {
    const validSignedPayload = comKey.verify(signature, request.body);
    if (!validSignedPayload) {
      comKey.log('Invalid signature verification', {
        signature,
        body: request.body,
        bodyString: JSON.stringify(request.body)
      });
      return response.status(400).json({ 
        msg: 'Failed integrity signature check - invalid signature' 
      });
    }
    next();
  } catch (error) {
    comKey.log('Error during signature verification', {
      error: error.message,
      signature,
      body: request.body
    });
    return response.status(400).json({ 
      msg: `Failed integrity signature check - ${error.message}` 
    });
  }
}

module.exports = {
  verifyPayloadIntegrity
}