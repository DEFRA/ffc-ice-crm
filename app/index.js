require('dotenv').config()
const server = require('./server')
const MessageProcessorService = require('./services/message-processor')

const init = async () => {
  await server.start()
  console.log('Server running on %s', server.info.uri)

  MessageProcessorService.getInstance()
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()

module.exports = init
