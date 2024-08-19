const api = require('./api')
const { trackException } = require('../insights')

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

  async createOnlineSubmissionActivity (body) {
    const { caseId, organisationId, contactId, submissionId, submissionDateTime, holdStatus, type, validCrns, crmBankAccountNumber, invalidCrns } = body

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
      rpa_onlinesubmissiondate: new Date(this.swapDateMonth(submissionDateTime)).toISOString(),
      rpa_onlinesubmissionid: `${submissionId}`,
      rpa_genericcontrol2: `${crmBankAccountNumber}`,
      subject: `${type} (${submissionId})`
    }

    if (holdStatus) {
      data.rpa_genericcontrol1 = holdStatus
    }

    if (validCrns?.length) {
      for (const c of validCrns) {
        data.rpa_onlinesubmission_activity_parties.push({
          participationtypemask: 2,
          'partyid_contact@odata.bind': `/contacts(${c})`
        })
      }
    }

    if (invalidCrns?.length) {
      data.rpa_genericerror1 = 'Invalid CRN(s)'
    }

    return api.post('/rpa_onlinesubmissions', data)
  }

  swapDateMonth = date => {
    const [datePart, timePart] = date.split(' ')
    const [day, month, year] = datePart.split('/')
    const newDate = `${month}/${day}/${year}`
    return `${newDate} ${timePart}`
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

    trackException(error)

    return api.post('/rpa_integrationinboundqueues', data)
  }
}

module.exports = CRMClient
