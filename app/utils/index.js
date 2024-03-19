const { ConfidentialClientApplication } = require('@azure/msal-node')

const isValidAccessToken = config => config.headers.Authorization &&
  config._tokenExpiry?.getTime() > Date.now()

const getAccessToken = async () => {
  try {
    // Initialize MSAL application with clientId and clientSecret
    const msalConfig = {
      auth: {
        clientId: process.env.CRM_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.CRM_TENANT_ID}`,
        clientSecret: process.env.CRM_CLIENT_SECRET
      }
    }

    const pca = new ConfidentialClientApplication(msalConfig)

    const host = process.env.CRM_API_HOST
    // Define the scope required for accessing Dynamics CRM
    const tokenRequest = {
      scopes: [`https://${host}/.default`]
    }

    // Acquire token using client credentials flow
    return await pca.acquireTokenByClientCredential(tokenRequest)
  } catch (err) {
    console.error('Error acquiring token:', err)
    throw new Error(err)
  }
}

module.exports = {
  getAccessToken,
  isValidAccessToken
}
