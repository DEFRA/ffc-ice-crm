const api = require('./api')

class CRMClient {
  static instance

  api

  constructor () {
    if (!this.instance) {
      this.instance = this
      this.api = api
    }
  }

  async checkOrganisation (id) {
    const path = encodeURI(`/accounts?$select=name,accountid,rpa_sbinumber,rpa_capfirmid&$filter=rpa_capfirmid eq '${id}'`)

    return this.api.get(path)
  }

  async checkContact (id) {
    const path = encodeURI(`/contacts?$select=contactid,fullname,rpa_capcustomerid&$filter=rpa_capcustomerid eq '${id}'`)

    return this.api.get(path)
  }

  async createCase (organisationId, contactId) {
    const data = {
      caseorigincode: '100000002', // valid for crm test env
      casetypecode: '927350013', // valid for crm test environment
      'customerid_contact@odata.bind': `/contacts(${contactId})`,
      'rpa_Contact@odata.bind': `/contacts(${contactId})`,
      'rpa_Organisation@odata.bind': `/accounts(${organisationId})`,
      rpa_isunknowncontact: false,
      rpa_isunknownorganisation: false,
      title: 'Online Submission - Bank Account Update' // + fileSubmission.uosr // from crm message
    }

    return this.api.post('/incidents?$select=incidentid,ticketnumber', data)
  }

  async createOnlineSubmissionActivity (
    caseId,
    organisationId,
    contactId,
    submissionId,
    submissionDateTime
  ) {
    const data = {
      'regardingobjectid_incident_rpa_onlinesubmission@odata.bind': `/incidents(${caseId})`,
      'rpa_SubmissionType_rpa_onlinesubmission@odata.bind': '/rpa_documenttypeses(db363964-c906-ee11-8f6e-0022489ede2f)', // hardcoded, will be provided by crm team, move to env
      rpa_filesinsubmission: '0', // hardcode for now
      rpa_onlinesubmission_activity_parties: [
        {
          participationtypemask: 1,
          'partyid_contact@odata.bind': `/contacts(${contactId})`
        },
        {
          participationtypemask: 11,
          'partyid_account@odata.bind': `/accounts(${organisationId})`
        }
      ],
      rpa_onlinesubmissiondate: new Date(submissionDateTime).toISOString(),
      rpa_onlinesubmissionid: submissionId, // or fileSubmission.uosr?
      subject: 'Online Submission Activity - Bank Account Update' // + fileSubmission.uosr"
    }

    return this.api.post('/rpa_onlinesubmissions', data)
  }

  async handleError () {
    const data = {
      rpa_name: '@{triggerBody().workflowRunId}',
      rpa_processingentity: "@{if(startsWith(toLower(triggerBody().callingWorkflowName),'rle'), 927350005, 927350006)}",
      rpa_xmlmessage: "Failed workflow: @{triggerBody().callingWorkflowName} \nFailed run: @{concat('https://portal.azure.com/#blade/Microsoft_Azure_EMA/DesignerEditor.ReactView/id/', encodeUriComponent(concat('/subscriptions/',appsetting('WORKFLOWS_SUBSCRIPTION_ID'), '/resourceGroups/', appsetting('WORKFLOWS_RESOURCE_GROUP_NAME'),'/providers/Microsoft.Web/sites/',appsetting('WORKFLOWS_LOGIC_APP_NAME'),'/workflows/',triggerBody().callingWorkflowName)),'/location/',appsetting('WORKFLOWS_LOCATION_NAME'),'/isReadOnly/true/isMonitoringView/true/runId/',triggerBody().workflowRunId)} \nError text: @{triggerBody().progressText} @{outputs('Strip_sensitive_data')}"
    }

    return this.api.post('/rpa_integrationinboundqueues', data)
  }
}

module.exports = CRMClient
