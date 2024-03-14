const axios = require('axios')
const { getAccessToken, isValidAccessToken } = require('../utils')

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

module.exports = axiosInstance
