const apiInstance = require('../../../../app/services/api')
const { getAccessToken, isValidAccessToken } = require('../../../../app/utils')

jest.mock('../../../../app/utils', () => ({
  getAccessToken: jest.fn(() => ({
    accessToken: 'valid_token',
    expiresOn: new Date()
  })),
  isValidAccessToken: jest.fn((config) => config.isValidAccessToken)
}))

describe('api.js', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.CRM_API_URL = 'your_mocked_api_url' // pragma: allowlist secret
  })

  describe('axios instance', () => {
    test('api returns instance', () => {
      expect(apiInstance).toBeDefined()

      expect(apiInstance.defaults.timeout).toEqual(30000)
      expect(apiInstance.defaults.headers.Accept).toEqual('application/json')
      expect(apiInstance.defaults.headers['Content-Type']).toEqual('application/json')
      expect(apiInstance.interceptors.request).toBeDefined()
      expect(apiInstance.interceptors.response).toBeDefined()
    })
  })

  describe('axios interceptors', () => {
    describe('request interceptor', () => {
      const error = { response: { status: 401, statusText: 'unauthorized' }, config: {} }

      test('should return config if token is valid', async () => {
        const result = await apiInstance.interceptors.request.handlers[0].fulfilled({
          isValidAccessToken: true,
          headers: {
            common: {
              Authorization: 'Bearer valid_token'
            }
          }
        })

        expect(isValidAccessToken.mock.calls.length).toBe(1)
        expect(getAccessToken.mock.calls.length).toBe(0)
        expect(result.headers.common.Authorization).toEqual('Bearer valid_token')
      })

      test('should get new access token if token is invalid', async () => {
        const result = await apiInstance.interceptors.request.handlers[0].fulfilled({
          isValidAccessToken: false,
          headers: {
            common: {
              Authorization: 'Bearer invalid_token'
            }
          }
        })

        expect(isValidAccessToken.mock.calls.length).toBe(1)
        expect(getAccessToken.mock.calls.length).toBe(1)
        expect(result.headers.common.Authorization).toEqual('Bearer valid_token')
        expect(result._tokenExpiry).toBeTruthy()
      })

      test('should return promise reject error if cannot get new access token', async () => {
        getAccessToken
          .mockImplementationOnce(jest.fn().mockRejectedValue(new Error('token_error')))

        await expect(apiInstance.interceptors.request.handlers[0].fulfilled({
          isValidAccessToken: false,
          headers: {
            common: {
              Authorization: 'Bearer invalid_token'
            }
          }
        })).rejects.toThrowError('token_error')

        expect(isValidAccessToken.mock.calls.length).toBe(1)
        expect(getAccessToken.mock.calls.length).toBe(1)
      })

      test('should throw error if error', async () => {
        await expect(apiInstance.interceptors.request.handlers[0].rejected(error))
          .rejects.toEqual(error)

        expect(getAccessToken.mock.calls.length).toBe(0)
      })
    })

    describe('response interceptor', () => {
      const authError = { response: { status: 401, statusText: 'unauthorized' }, config: {} }
      const authErrorRetried = { response: { status: 401, statusText: 'unauthorized' }, config: { _retry: true } }
      const exceptionError = { response: { status: 500, statusText: 'exception' }, config: {} }
      const successResponse = { data: { foo: 'bar' } }

      test('should return response if token is valid', async () => {
        const result = await apiInstance.interceptors.response.handlers[0].fulfilled(successResponse)

        expect(getAccessToken.mock.calls.length).toBe(0)
        expect(result).toEqual(successResponse)
      })

      test('should get new access token if auth error 401', async () => {
        await expect(apiInstance.interceptors.response.handlers[0].rejected(authError))
          .rejects.toThrowError()

        expect(getAccessToken.mock.calls.length).toBe(2)
      })

      test('should throw error if auth error 401 on retry', async () => {
        await expect(apiInstance.interceptors.response.handlers[0].rejected(authErrorRetried))
          .rejects.toThrowError('unauthorized')

        expect(getAccessToken.mock.calls.length).toBe(0)
      })

      test('should throw error if exception error 500', async () => {
        await expect(apiInstance.interceptors.response.handlers[0].rejected(exceptionError))
          .rejects.toThrowError('exception')

        expect(getAccessToken.mock.calls.length).toBe(0)
      })
    })
  })
})
