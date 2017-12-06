const express = require('express')
const http = require('http')
const cors = require('cors')
const url = require('url')
const jwt = require('jsonwebtoken')
const validate = require('express-joi-validator')
const Joi = require('joi')
const boom = require('express-boom')
const parser = require('route-parser')
const WebSocket = require('ws')
const Routes = require('routes')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(cors())

// Static Folder
app.static = folder => app.use(express.static(folder))

// Secret
app.secret = secret => app.secret = secret

// View
app.set('view engine', 'pug')

// Authentication
const authentification = req => new Promise((resolve, reject) => {
  const { query: { token }} = url.parse(req.url, true)
  const { secret } = app

  try {
    const auth = jwt.verify(token, secret)

    resolve(auth)
  } catch(err) {
    if (err.name === 'JsonWebTokenError') reject(err)
  }
})

app.auth = secret => app.use(async(async (req, res, next) => {
  try {
    const valid = await authentification(req)
        
    next()
  } catch({ name, message }) {
    res.boom.unauthorized()
  }
}))

// Boom
app.use(boom())

const matchRoute = (route, url) => {
  const routes = new Routes()

  routes.addRoute(route, () => {})

  return routes.match(url)
}

// Websocket
app.ws = (route, validation, cb) => {
  cb = cb || validation

  wss.on('connection', async(async (ws, req) => {
    const { search, pathname } = url.parse(req.url)
    const { query: { token }} = url.parse(req.url, true)

    if (typeof validation === 'object') {
      const { params } = matchRoute(route, req.url.replace(search, ''))
      const valid = Joi.validate({ params }, validation)

      if (valid.error) {
        ws.send(JSON.stringify(valid))

        return ws.close()
      }
    }

    try {
      const valid = await authentification(req)
      const parse = new parser(route)
        
      req.params = parse.match(pathname)

      cb(req, ws)
    } catch(err) {
      ws.send(JSON.stringify({ error: 'authentication' }))

      ws.close()
    }
  }))
}

// Async
const async = cb => (req, res, next) => {
  Promise
    .resolve(cb(req, res, next))
    .catch(next)
}

// Server
app.listen = (port, cb) => server.listen(port, cb)

module.exports = { app, async, validate }
