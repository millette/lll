"use strict"

// npm
import test from "ava"

// self
import getDb, { LevelErrors } from ".."
import { beforeEach, afterEach } from "./_helpers"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("create user and destroy db", async (t) => {
  const password = "elPassword"
  const badPassword = "elPassword666"
  const _id = "b-ob"
  const badId = "ji-m"
  const email = "joe@example.com"
  const badEmail = "joeexample.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  t.throwsAsync(() => users.register({ _id, password, email: badEmail }), {
    instanceOf: LevelErrors.WriteError,
  })

  await users.register({ _id, password, email })

  await users.login({ _id, password })

  t.throwsAsync(() => users.register({ _id, password }), {
    message: "User already exists.",
  })

  t.throwsAsync(() => users.get(_id), {
    message: "UserTable.get() is not implemented.",
  })

  t.throwsAsync(() => users.put({ _id, password }), {
    message: "UserTable.put() is not implemented.",
  })

  t.throwsAsync(() => users.login({ _id, password: badPassword }), {
    message: "Password does not match.",
  })

  t.throwsAsync(() => users.login({ _id: badId, password }), {
    instanceOf: LevelErrors.NotFoundError,
  })

  await users.register({ _id: badId, password })

  await db.destroy()
  t.pass()
})
