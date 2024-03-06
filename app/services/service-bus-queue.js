const { DefaultAzureCredential } = require('@azure/identity')
const { delay, ServiceBusClient } = require('@azure/service-bus')

const CRMClient = require('./crm-client')

const CONNECTION_RETRIES = 5
const RETRY_DELAY = 5000
const HEADER_SUBSTRING_START = 37
const HEADER_SUBSTRING_END = 1

class ServiceBusQueue {
  static instance

  serviceBusClient
  crmClient

  constructor () {
    if (!this.instance) {
      this.instance = this
      this.crmClient = new CRMClient()
    }
  }

  async connect () {
    try {
      await this.connectToServiceBus(CONNECTION_RETRIES)
      await this.subscribeToQueue(process.env.CASE_DETAILS_QUEUE)
    } catch (err) {
      console.log(err)
    }
  }

  async connectToServiceBus (retryAttempts = 1) {
    let connectionAttempt = 0

    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING
    const host = process.env.SERVICE_BUS_HOST
    const username = process.env.SERVICE_BUS_USERNAME
    const password = process.env.SERVICE_BUS_PASSWORD

    while (connectionAttempt < retryAttempts) {
      let skipRetry = false
      const currentAttempt = connectionAttempt + 1

      const logSuccessMessage = 'Successfully connected to Azure Service Bus!'

      try {
        if (connectionString) {
          this.serviceBusClient = new ServiceBusClient(connectionString)
          console.log(logSuccessMessage)
          return
        } else if (host && username && password) {
          this.serviceBusClient = new ServiceBusClient(`Endpoint=sb://${host}/;SharedAccessKeyName=${username};SharedAccessKey=${password}`)
          console.log(logSuccessMessage)
          return
        } else if (host) {
          this.serviceBusClient = new ServiceBusClient(host, new DefaultAzureCredential())
          console.log(logSuccessMessage)
          return
        } else {
          skipRetry = true
          throw new Error('Missing credentials to connect to Azure Service Bus')
        }
      } catch (err) {
        console.error(
          `Error connecting to Azure Service Bus (Attempt ${currentAttempt}):`,
          err
        )

        if (currentAttempt === retryAttempts || skipRetry) {
          throw new Error(err)
        }

        await delay(RETRY_DELAY)

        connectionAttempt++
      }
    }
  }

  async subscribeToQueue (queueName) {
    try {
      const receiver = this.serviceBusClient?.createReceiver(queueName, {
        receiveMode: 'peekLock'
      })

      if (!receiver) {
        console.error(`ServiceBusClient: ${queueName} not initialised`)
        return
      }

      receiver.subscribe({
        processMessage: async (message) => this.processQueueMessage(message, receiver),
        processError: async (err) => this.handleError(err)
      }, {
        autoCompleteMessages: false
      })
    } catch (err) {
      console.error('Error setting up message receiver:', err)
    }
  }

  async processQueueMessage (
    message,
    receiver,
    retryAttempts = 0
  ) {
    try {
      const { body } = message
      console.log(`${receiver.entityPath}: Message received:`)
      console.log(body)

      await this.processMessageToCRM(body)

      await receiver.completeMessage(message)

      return true
    } catch (err) {
      if (retryAttempts > 0) {
        console.log(
          `Retry message processing (${retryAttempts} attempts remaining)`,
          err
        )
        return this.processQueueMessage(message, receiver, retryAttempts - 1)
      } else {
        console.error('Moving message to Dead-letter Queue:', err)
        await receiver.deadLetterMessage(message)
        return false
      }
    }
  }

  async processMessageToCRM (body) {
    const { sbi, frn, submissionId, submissionDateTime } = body

    let organisationId
    let contactId
    let caseId

    try {
      const organisation = await this.crmClient.checkOrganisation(sbi)
      organisationId = organisation.data.value[0].accountid
      console.log('Organisation ID', organisationId)
      if (!organisationId) {
        throw new Error('Could not find organisationId')
      }
    } catch (err) {
      console.error('Could not get organisation ID', err)
      throw new Error(err)
    }

    try {
      const contact = await this.crmClient.checkContact(frn)
      contactId = contact.data.value[0].contactid
      console.log('Contact ID', contactId)
      if (!contactId) {
        throw new Error('Could not find contactId')
      }
    } catch (err) {
      console.error('Could not get contact ID', err)
      throw new Error(err)
    }

    try {
      const crmCase = await this.crmClient.createCase(organisationId, contactId)
      console.log('Case response', crmCase.status)
      const caseUrl = crmCase.headers['odata-entityid']
      caseId = caseUrl.substring(
        caseUrl.length - HEADER_SUBSTRING_START,
        caseUrl.length - HEADER_SUBSTRING_END
      )
      console.log('Case ID', caseId)
      if (!caseId) {
        throw new Error('Could not find caseId')
      }
    } catch (err) {
      console.error(`Could not get create case for ${body}:`, err)
      throw new Error(err)
    }

    try {
      const crmActivity = await this.crmClient.createOnlineSubmissionActivity(
        caseId,
        organisationId,
        contactId,
        submissionId,
        submissionDateTime
      )
      console.log('Activity response', crmActivity.status)
    } catch (err) {
      console.error(`Could not get create online submission activity for ${JSON.stringify(body)}:`, err)
      throw new Error(err)
    }
  }

  async handleError (err) {
    return console.log(err)
  }
}

module.exports = ServiceBusQueue
