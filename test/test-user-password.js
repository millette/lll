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
  t.pass()

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

  const oy2 = await users.resetPassword({ _id })
  await users.useToken({ _id, token: oy2, password })

  t.pass()

  await db.destroy()
  t.pass()
})
