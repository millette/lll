#!/usr/bin/env node

/*
 * lll module.
 * @module lll
 */

"use strict"

// self
const getDb = require(".")

const fastify = require("fastify")({ logger: true })

fastify.register(require("fastify-formbody"))

getDb("web-db").then((db) => fastify.decorate("db", db))

fastify.get("/", async (request, reply) => {
  reply.type("text/html")
  return `<ol>
  <li><a href="/register">Register</a></li>
  <li><a href="/login">Login</a></li>
  </ol>`
})

fastify.get("/register", async (request, reply) => {
  reply.type("text/html")
  return `<form method="post">
  <label>username <input required type="text" name="username"></label><br>
  <label>email <input type="email" name="email"></label><br>
  <label>password <input required type="password" name="password"></label><br>
  <label>password <input required type="password" name="password2"></label><br>
  <button>Submit</button>
  </form>`
})

fastify.post("/register", async function(
  { body: { password, password2, username: _id, email } },
  reply
) {
  if (!password || !password2) throw new Error("Password required.")
  if (password !== password2) throw new Error("Passwords don't match.")
  const users = this.db.getUsers()
  return users.register({ _id, password, email })
})

fastify.get("/login", async (request, reply) => {
  reply.type("text/html")
  return `<form method="post">
  <label>username or email<input required type="text" name="username"></label><br>
  <label>password <input required type="password" name="password"></label><br>
  <button>Submit</button>
  </form>`
})

fastify.post("/login", async function(
  { body: { password, username: _id } },
  reply
) {
  const users = this.db.getUsers()
  return users.login({ _id, password })
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
