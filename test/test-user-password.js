"use strict"

// npm
import test from "ava"
import LevelErrors from "level-errors"

// self
import getDb from ".."
import { beforeEach, afterEach } from "./_helpers"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("reset password", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const badId = "bobo"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })
  await t.throwsAsync(() => users.resetPassword({ _id: badId }), {
    instanceOf: LevelErrors.NotFoundError,
    message: /^Key not found in database /,
  })

  await db.destroy()
  t.pass()
})

test("reset password (2)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })
  await users.resetPassword({ _id })

  await db.destroy()
  t.pass()
})

test("reset password (3)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })
  await t.throwsAsync(() => users.resetPassword({}), {
    message: "Email or _id required.",
  })

  await db.destroy()
  t.pass()
})

test("reset password (4)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })
  await users.resetPassword({ _id })
  await users.resetPassword({ _id })

  await db.destroy()
  t.pass()
})

test("use token", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  const token = await users.resetPassword({ _id, validFor: 0 })
  await t.throwsAsync(() => users.useToken({ _id, token, password }), {
    message: "Invalid token.",
  })

  await db.destroy()
  t.pass()
})

test("use token (2)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  const token = await users.resetPassword({ _id })
  await users.useToken({ _id, token, password })

  await db.destroy()
  t.pass()
})

test("use token (3)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  const token = await users.resetPassword({ _id })
  await t.throwsAsync(() => users.useToken({ _id, token }), {
    message: "New password must be supplied.",
  })

  await db.destroy()
  t.pass()
})

test("use token (4)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  await users.resetPassword({ _id })
  await t.throwsAsync(() => users.useToken({ _id }), {
    message: "Invalid token.",
  })

  await db.destroy()
  t.pass()
})
