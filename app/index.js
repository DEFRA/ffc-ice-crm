require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
const server = require('./server')
const ServiceBusQueue = require('./services/service-bus-queue')

const init = async () => {
  await server.start()
  console.log('Server running on %s', server.info.uri)

  const sbQueue = new ServiceBusQueue()
  await sbQueue.connect()
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
