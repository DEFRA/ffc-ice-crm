describe('CRM Client test', () => {
  test('crmClient returns instance', () => {
    const crmClient = require('../../../../app/services/crm-client')

    expect(crmClient).toBeDefined()
  })
})
