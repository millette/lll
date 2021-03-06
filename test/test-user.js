"use strict"

// npm
import test from "ava"
import LevelErrors from "level-errors"

// self
import getDb from ".."
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
    message: "Malformed email.",
  })

  await users.register({ _id, password, email })

  await users.login({ _id, password })

  t.throwsAsync(() => users.register({ _id, password }), {
    instanceOf: LevelErrors.WriteError,
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

test("unique emails", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const id2 = "ji-m"
  const email = "joe+1@example.com"
  const email2 = "joe+2@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  await t.throwsAsync(() => users.register({ _id: id2, password, email }), {
    instanceOf: LevelErrors.WriteError,
    message: "Email already exists.",
  })

  await t.throwsAsync(
    () => users.register({ _id: id2, password, email: email2 }),
    {
      instanceOf: LevelErrors.WriteError,
      message: "Email already exists.",
    }
  )

  await db.destroy()
  t.pass()
})

test("create user (email required)", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const _id2 = "ji-m"
  const email = "joe@example.com"

  const db = await getDb(t.context.loc, {
    emailRequired: true,
    level: { errorIfExists: true },
  })
  const users = db.getUsers()

  await t.throwsAsync(() => users.register({ _id, password }), {
    instanceOf: LevelErrors.WriteError,
  })

  await users.register({ _id: _id2, password, email })

  await db.destroy()
  t.pass()
})

test("email login", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe@example.com"
  const badEmail = "bob@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })

  await users.login({ email, password })
  await users.login({ _id: email, password })

  await t.throwsAsync(() => users.login({ email: badEmail, password }), {
    instanceOf: LevelErrors.NotFoundError,
  })

  await db.destroy()
  t.pass()
})

test("email login uppper/lowercase", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const _idMixed = "B-ob"
  const _id2 = "ji-m"
  const _id2Mixed = "jI-m"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id: _idMixed, password })
  await users.login({ _id, password })
  await users.register({ _id: _id2Mixed, password })
  await users.login({ _id: _id2, password })

  await db.destroy()
  t.pass()
})

test("email alias login", async (t) => {
  const password = "elPassword"
  const _id = "b-ob"
  const email = "joe+666@example.com"
  const email2 = "JOE+777@example.com"
  const email3 = "joe@example.com"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()

  await users.register({ _id, password, email })
  await users.login({ email, password })
  await users.login({ email: email2, password })
  await users.login({ email: email3, password })

  await db.destroy()
  t.pass()
})
