const { DefaultAzureCredential } = require('@azure/identity')
const { delay, ServiceBusClient } = require('@azure/service-bus')

const CRMClient = require('./crm-client')

const CONNECTION_RETRIES = 5
const RETRY_DELAY = 5000
const HEADER_SUBSTRING_START = 37
const HEADER_SUBSTRING_END = 1

class MessageProcessorService {
  static instance

  #serviceBusClient
  #crmClient = new CRMClient()
  #receiver

  constructor () {
    this.connect()
  }

  static getInstance () {
    if (!this.instance) {
      this.instance = new MessageProcessorService()
    }

    return this.instance
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
          this.#serviceBusClient = new ServiceBusClient(connectionString)
          console.log(logSuccessMessage)
          return
        } else if (host && username && password) {
          this.#serviceBusClient = new ServiceBusClient(`Endpoint=sb://${host}/;SharedAccessKeyName=${username};SharedAccessKey=${password}`)
          console.log(logSuccessMessage)
          return
        } else if (host) {
          this.#serviceBusClient = new ServiceBusClient(host, new DefaultAzureCredential())
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
          throw err
        }

        await delay(RETRY_DELAY)

        connectionAttempt++
      }
    }
  }

  async subscribeToQueue (queueName) {
    try {
      this.#receiver = this.#serviceBusClient?.createReceiver(queueName, {
        receiveMode: 'peekLock'
      })

      if (!this.#receiver) {
        console.error(`ServiceBusClient: ${queueName} not initialised`)
        return
      }

      this.#receiver.subscribe({
        processMessage: async (message) => this.processQueueMessage(message),
        processError: async (err) => this.#crmClient.handleError(err)
      }, {
        autoCompleteMessages: false
      })
      console.log(`Started listening for messages on queue: ${queueName}`)
    } catch (err) {
      console.error('Error setting up message receiver:', err)
    }
  }

  async processQueueMessage (message) {
    try {
      const { body } = message

      console.log(`Message received: ${this.#receiver.entityPath}:`)
      console.log(body)

      await this.processMessageToCRM(body)

      await this.#receiver.completeMessage(message)
      console.log('Message completed')
      return true
    } catch (err) {
      console.log('Sending error message to CRM')
      await this.#crmClient.handleError(err)

      console.log('Moving message to Dead-letter Queue')
      await this.#receiver.deadLetterMessage(message)
      return false
    }
  }

  async processMessageToCRM (body) {
    const { frn, crn, SubmissionId, submissionDateTime, type } = body

    let organisationId
    let contactId
    let caseId
    let activityId

    let logMessage = ''
    let lastStatusCode

    try {
      const organisation = await this.#crmClient.checkOrganisation(frn)
      organisationId = organisation.data.value[0].accountid

      console.log('Organisatoin ID:', organisationId)
      lastStatusCode = organisation.status
      logMessage += `Organisation ID: ${organisationId} - Status Code: ${organisation.status}`

      if (!organisationId) {
        throw new Error('Could not find organisationId')
      }

      const contact = await this.#crmClient.checkContact(crn)
      contactId = contact.data.value[0].contactid

      console.log('Contact ID:', contactId)
      lastStatusCode = contact.status
      logMessage += `\nContact ID: ${contactId} - Status Code: ${contact.status}`

      if (!contactId) {
        throw new Error('Could not find contactId')
      }

      const crmCase = await this.#crmClient.createCase(
        organisationId,
        contactId,
        SubmissionId,
        type
      )

      const caseUrl = crmCase.headers['odata-entityid']
      caseId = caseUrl.substring(
        caseUrl.length - HEADER_SUBSTRING_START,
        caseUrl.length - HEADER_SUBSTRING_END
      )

      console.log('Case ID:', caseId)
      lastStatusCode = crmCase.status
      logMessage += `\nCase ID: ${caseId} - Status Code: ${crmCase.status}`

      if (!caseId) {
        throw new Error('Could not find caseId')
      }

      const crmActivity = await this.#crmClient.createOnlineSubmissionActivity(
        caseId,
        organisationId,
        contactId,
        SubmissionId,
        submissionDateTime,
        type
      )

      const activityUrl = crmActivity.headers['odata-entityid']
      activityId = activityUrl.substring(
        activityUrl.length - HEADER_SUBSTRING_START,
        activityUrl.length - HEADER_SUBSTRING_END
      )

      console.log('Activity ID:', activityId)
      lastStatusCode = crmActivity.status
      logMessage += `\nOnline Submission Activity ID: ${activityId} - Status Code: ${crmActivity.status}`

      console.log('Message processed to CRM')
    } catch (err) {
      err.submissionId = SubmissionId
      err.statusCode = lastStatusCode
      err.log = logMessage
      console.error('Could not process message to CRM:', err)
      throw err
    }
  }
}

module.exports = MessageProcessorService
