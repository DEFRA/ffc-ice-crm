const utils = require('../../../../app/utils')

jest.mock('@azure/msal-node', () => {
  const mockConfidentialClientApplication = {
    acquireTokenByClientCredential: jest.fn()
  }

  const mockToken = 'bearer_token'

  mockConfidentialClientApplication
    .acquireTokenByClientCredential.mockReturnValue(mockToken)

  const ConfidentialClientApplication = jest.fn((params) => {
    if (params.auth.clientId === 'invalid' || params.auth.clientSecret === 'invalid') {
      throw new Error('Invalid params')
    }

    return mockConfidentialClientApplication
  })

  return {
    ConfidentialClientApplication
  }
})

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.CRM_CLIENT_ID = 'your_mocked_client_id' // pragma: allowlist secret
    process.env.CRM_TENANT_ID = 'your_mocked_tenant_id' // pragma: allowlist secret
    process.env.CRM_CLIENT_SECRET = 'your_mocked_client_secret' // pragma: allowlist secret
    process.env.CRM_API_HOST = 'your_mocked_host' // pragma: allowlist secret
  })

  describe('should get an access token', () => {
    test('should call getAccessToken', async () => {
      const getAccessTokenSpy = jest.spyOn(utils, 'getAccessToken')

      const result = await utils.getAccessToken()

      expect(result).toEqual('bearer_token')
      expect(getAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should throw error if invalid client id', async () => {
      process.env.CRM_CLIENT_ID = 'invalid' // pragma: allowlist secret

      const getAccessTokenSpy = jest.spyOn(utils, 'getAccessToken')

      await expect(utils.getAccessToken()).rejects.toThrowError()

      expect(getAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should throw error if invalid client secret', async () => {
      process.env.CRM_CLIENT_SECRET = 'invalid' // pragma: allowlist secret

      const getAccessTokenSpy = jest.spyOn(utils, 'getAccessToken')

      await expect(utils.getAccessToken()).rejects.toThrowError()

      expect(getAccessTokenSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('should check is valid access token', () => {
    test('should return true when valid', () => {
      const getIsValidAccessTokenSpy = jest.spyOn(utils, 'isValidAccessToken')

      const expiry = new Date()
      expiry.setDate(expiry.getDate() + 1)

      const result = utils.isValidAccessToken({
        headers: {
          Authorization: 'bearer_token'
        },
        _tokenExpiry: expiry
      })

      expect(result).toBeTruthy()
      expect(getIsValidAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should return false when no token', () => {
      const getIsValidAccessTokenSpy = jest.spyOn(utils, 'isValidAccessToken')

      const expiry = new Date()
      expiry.setDate(expiry.getDate() + 1)

      const result = utils.isValidAccessToken({
        headers: {
          Authorization: ''
        },
        _tokenExpiry: expiry
      })

      expect(result).toBeFalsy()
      expect(getIsValidAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should return false when token expired', () => {
      const getIsValidAccessTokenSpy = jest.spyOn(utils, 'isValidAccessToken')

      const expiry = new Date()
      expiry.setDate(expiry.getDate() - 1)

      const result = utils.isValidAccessToken({
        headers: {
          Authorization: 'bearer_token'
        },
        _tokenExpiry: expiry
      })

      expect(result).toBeFalsy()
      expect(getIsValidAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should return false when no token + expired', () => {
      const getIsValidAccessTokenSpy = jest.spyOn(utils, 'isValidAccessToken')

      const expiry = new Date()
      expiry.setDate(expiry.getDate() - 1)

      const result = utils.isValidAccessToken({
        headers: {
          Authorization: ''
        },
        _tokenExpiry: expiry
      })

      expect(result).toBeFalsy()
      expect(getIsValidAccessTokenSpy).toHaveBeenCalledTimes(1)
    })

    test('should return false when token + no expiry', () => {
      const getIsValidAccessTokenSpy = jest.spyOn(utils, 'isValidAccessToken')

      const expiry = new Date()
      expiry.setDate(expiry.getDate() - 1)

      const result = utils.isValidAccessToken({
        headers: {
          Authorization: 'bearer_token'
        }
      })

      expect(result).toBeFalsy()
      expect(getIsValidAccessTokenSpy).toHaveBeenCalledTimes(1)
    })
  })
})
