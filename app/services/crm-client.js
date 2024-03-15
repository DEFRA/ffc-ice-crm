const api = require('./api')

class CRMClient {
  async checkOrganisation (id) {
    const path = encodeURI(`/accounts?$select=name,accountid,rpa_sbinumber,rpa_capfirmid&$filter=rpa_capfirmid eq '${id}'`)

    return api.get(path)
  }

  async checkContact (id) {
    const path = encodeURI(`/contacts?$select=contactid,fullname,rpa_capcustomerid&$filter=rpa_capcustomerid eq '${id}'`)

    return api.get(path)
  }

  async createCase (
    organisationId,
    contactId,
    submissionId,
    type
  ) {
    const data = {
      caseorigincode: process.env.CASE_ORIGIN_CODE,
      casetypecode: process.env.CASE_TYPE_CODE,
      'customerid_contact@odata.bind': `/contacts(${contactId})`,
      'rpa_Contact@odata.bind': `/contacts(${contactId})`,
      'rpa_Organisation@odata.bind': `/accounts(${organisationId})`,
      rpa_isunknowncontact: false,
      rpa_isunknownorganisation: false,
      title: `${type} (${submissionId})`
    }

    return api.post('/incidents?$select=incidentid,ticketnumber', data)
  }

  async createOnlineSubmissionActivity (
    caseId,
    organisationId,
    contactId,
    submissionId,
    submissionDateTime,
    holdStatus,
    type
  ) {
    const data = {
      'regardingobjectid_incident_rpa_onlinesubmission@odata.bind': `/incidents(${caseId})`,
      'rpa_SubmissionType_rpa_onlinesubmission@odata.bind': `/rpa_documenttypeses(${process.env.RPA_DOCUMENT_TYPES_ES})`,
      rpa_filesinsubmission: process.env.RPA_FILES_IN_SUBMISSION,
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
      rpa_onlinesubmissionid: `${submissionId}`,
      subject: `${type} (${submissionId})`
    }

    if (holdStatus === 'rpa_holdstatus1') {
      data.rpa_holdstatus1 = true
    }

    return api.post('/rpa_onlinesubmissions', data)
  }

  async handleError (error) {
    const errorMessage = {
      stack: error.stack,
      ...error
    }

    const data = {
      rpa_name: error.submissionId,
      rpa_processingentity: process.env.RPA_PROCESSING_ENTITY,
      rpa_xmlmessage: JSON.stringify(errorMessage)
    }

    return api.post('/rpa_integrationinboundqueues', data)
  }
}

module.exports = CRMClient
