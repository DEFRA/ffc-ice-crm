const appInsights = require('applicationinsights')
const { setup } = require('../../../../app/insights')

jest.mock('applicationinsights', () => {
  const startMock = jest.fn()

  const mockedSetup = jest.fn((message) => {
    const result = jest.fn(() => ({
      start: startMock
    }))
    result.start = startMock
    return result
  })

  return {
    setup: mockedSetup,
    start: startMock,
    defaultClient: {
      context: {
        keys: { cloudRole: 'your_mocked_cloudRole' },
        tags: {}
      }
    }
  }
})

describe('App Insights Setup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should set up App Insights when APPINSIGHTS_CONNECTIONSTRING is provided', () => {
    process.env.APPINSIGHTS_CONNECTIONSTRING = 'your_connection_string'
    process.env.APPINSIGHTS_CLOUDROLE = 'your_app_name'
    const setupSpy = jest.spyOn(appInsights, 'setup')
    setup()
    expect(setupSpy).toHaveBeenCalled()
  })

  test('should console log when APPINSIGHTS_CONNECTIONSTRING is not provided', () => {
    delete process.env.APPINSIGHTS_CONNECTIONSTRING
    delete process.env.APPINSIGHTS_CLOUDROLE

    const setupSpy = jest.spyOn(appInsights, 'setup')
    setup()
    expect(setupSpy).toHaveBeenCalledTimes(0)
  })

  afterAll(() => {
    delete process.env.APPINSIGHTS_CONNECTIONSTRING
    delete process.env.APPINSIGHTS_CLOUDROLE
  })
})
