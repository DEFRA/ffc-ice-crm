const MessageProcessorService = require('../../../../app/services/message-processor')

jest.mock('@azure/service-bus', () => {
  const mockServiceBusClient = {
    createReceiver: jest.fn()
  }

  const mockReceiver = {
    subscribe: jest.fn(),
    completeMessage: jest.fn(async (message) => {}),
    deadLetterMessage: jest.fn(async (message) => {})
  }

  mockServiceBusClient.createReceiver.mockReturnValue(mockReceiver)

  const ServiceBusClient = jest.fn((params) => {
    if (params === 'invalid') {
      throw new Error('Invalid params')
    }

    return mockServiceBusClient
  })

  return {
    ServiceBusClient
  }
})

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn()
}))

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn((url) => {
      console.log('url', url)
      if (url.indexOf('undefined') < 0) {
        return {
          data: {
            value: [
              {
                accountid: 'accountid',
                contactid: 'contactid'
              }
            ]
          }
        }
      } else {
        return {
          data: {
            value: []
          }
        }
      }
    }),
    post: jest.fn(() => ({
      headers: {
        'odata-entityid': 'a5803822-dbcb-4088-979c-288d088a939f'
      }
    })),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  }))
}))

// todo: mock crm client

describe('MessageProcessorService', () => {
  let service

  beforeEach(() => {
    jest.clearAllMocks()
    service = MessageProcessorService.getInstance()

    process.env.SERVICE_BUS_CONNECTION_STRING = 'your_mocked_connection_string' // pragma: allowlist secret
    process.env.SERVICE_BUS_HOST = 'your_mocked_host' // pragma: allowlist secret
    process.env.SERVICE_BUS_USERNAME = 'your_mocked_username' // pragma: allowlist secret
    process.env.SERVICE_BUS_PASSWORD = 'your_mocked_password' // pragma: allowlist secret
    process.env.CASE_DETAILS_QUEUE = 'your_case_queue' // pragma: allowlist secret
  })

  test('should create an instance', async () => {
    expect(service).toBeInstanceOf(MessageProcessorService)
  })

  describe('should connect to service bus, subscribe to queue and receive messages', () => {
    test('should connect to service bus and subscribe to queue', async () => {
      const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')
      const receiveMessageFromQueueSpy = jest.spyOn(service, 'subscribeToQueue')

      await service.connect()

      expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
      expect(receiveMessageFromQueueSpy).toHaveBeenCalledTimes(1)
    })

    describe('should connect to service bus', () => {
      describe('should connect to service bus with valid credentials', () => {
        test('should connect to service bus using connection string', async () => {
          const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')

          await service.connectToServiceBus()

          expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
        })

        test('should connect to service bus using username password and host', async () => {
          delete process.env.SERVICE_BUS_CONNECTION_STRING

          const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')

          await service.connectToServiceBus()

          expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
        })

        test('should connect to service bus using host only', async () => {
          delete process.env.SERVICE_BUS_CONNECTION_STRING
          delete process.env.SERVICE_BUS_USERNAME
          delete process.env.SERVICE_BUS_PASSWORD

          const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')

          await service.connectToServiceBus()

          expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
        })
      })

      describe('should throw error with missing/invalid credentials', () => {
        test('should throw an error if missing credentials', async () => {
          delete process.env.SERVICE_BUS_CONNECTION_STRING
          delete process.env.SERVICE_BUS_HOST
          delete process.env.SERVICE_BUS_USERNAME
          delete process.env.SERVICE_BUS_PASSWORD

          const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')

          await expect(service.connectToServiceBus()).rejects.toThrowError('Missing credentials to connect to Azure Service Bus')
          expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
        })

        test('should throw an error if credentials are invalid', async () => {
          process.env.SERVICE_BUS_CONNECTION_STRING = 'invalid' // pragma: allowlist secret

          const connectToServiceBusSpy = jest.spyOn(service, 'connectToServiceBus')

          await expect(service.connectToServiceBus()).rejects.toThrowError()
          expect(connectToServiceBusSpy).toHaveBeenCalledTimes(1)
        })
      })
    })

    describe('should subscribe to queue and intialize receiver', () => {
      test('should successfully initialize the reciever', async () => {
        const receiveMessageFromQueueSpy = jest.spyOn(service, 'subscribeToQueue')

        await service.subscribeToQueue()

        expect(receiveMessageFromQueueSpy).toHaveBeenCalledTimes(1)
      })
    })

    describe('should successfully process the queue message', () => {
      test('should successfully process queue message', async () => {
        const processQueueMessageSpy = jest.spyOn(service, 'processQueueMessage')

        await service.processQueueMessage({ body: {} })

        expect(processQueueMessageSpy).toHaveBeenCalledTimes(1)
      })

      describe('should send message to the CRM', () => {
        test('should successfully send message to the CRM', async () => {
          const processMessageToCRMSpy = jest.spyOn(service, 'processMessageToCRM')

          await service.processMessageToCRM({
            frn: 'frn',
            crn: 'crn',
            SubmissionId: 'SubmissionId',
            submissionDateTime: new Date(),
            type: 'type'
          })

          expect(processMessageToCRMSpy).toHaveBeenCalledTimes(1)
        })

        test('should throw an error if organisation id could not be found', async () => {
          const processMessageToCRMSpy = jest.spyOn(service, 'processMessageToCRM')

          await expect(service.processMessageToCRM({
            crn: 'crn',
            SubmissionId: 'SubmissionId',
            submissionDateTime: new Date(),
            type: 'type'
          })).rejects.toThrowError()

          expect(processMessageToCRMSpy).toHaveBeenCalledTimes(1)
        })

        test('should throw an error if contact id could not be found', async () => {
          const processMessageToCRMSpy = jest.spyOn(service, 'processMessageToCRM')

          await expect(service.processMessageToCRM({
            frn: 'frn',
            SubmissionId: 'SubmissionId',
            submissionDateTime: new Date(),
            type: 'type'
          })).rejects.toThrowError()

          expect(processMessageToCRMSpy).toHaveBeenCalledTimes(1)
        })

        test('should throw an error if message body is empty', async () => {
          const processMessageToCRMSpy = jest.spyOn(service, 'processMessageToCRM')

          await expect(service.processMessageToCRM({})).rejects.toThrowError()
          expect(processMessageToCRMSpy).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
})

afterAll(() => {
  delete process.env.SERVICE_BUS_CONNECTION_STRING
  delete process.env.SERVICE_BUS_HOST
  delete process.env.SERVICE_BUS_USERNAME
  delete process.env.SERVICE_BUS_PASSWORD
})
