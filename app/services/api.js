const axios = require('axios')
const { ConfidentialClientApplication } = require('@azure/msal-node')

const axiosInstance = axios.create({
  baseURL: process.env.CRM_API_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
})

axiosInstance.interceptors.request.use(async config => {
  if (isValidAccessToken(config)) {
    return config
  }

  const token = await getAccessToken()

  config.headers.Authorization = `Bearer ${token.accessToken}`
  config._tokenExpiry = token.expiresOn

  return config
},
err => {
  Promise.reject(err)
})

axiosInstance.interceptors.response.use(response => (
  response
), async (err) => {
  const originalRequest = err.config
  const unauthorizedStatusCode = 401
  if (err.response?.status === unauthorizedStatusCode && !originalRequest._retry) {
    originalRequest._retry = true

    const token = await getAccessToken()

    axios.defaults.headers.common.Authorization = `Bearer ${token.accessToken}`
    axios.defaults._tokenExpiry = token.expiresOn

    return axiosInstance(originalRequest)
  }
  return Promise.reject(err.response?.statusText)
})

const isValidAccessToken = config => config.headers.Authorization &&
  config._tokenExpiry.getTime() < Date.now()

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

module.exports = axiosInstance
