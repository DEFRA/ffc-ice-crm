require('./insights').setup()
const Hapi = require('@hapi/hapi')
const routes = require('./routes')

const server = Hapi.server({
  port: process.env.PORT,
  host: 'localhost'
})

const serverRoutes = [].concat(
  routes.healthy,
  routes.healthz
)

server.route(serverRoutes)

module.exports = server
