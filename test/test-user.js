"use strict"

// npm
import test from "ava"

// self
import getDb from ".."
import { beforeEach, afterEach } from "./_helpers"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("create user and destroy db", async (t) => {
  const password = "elPassword"
  const badPassword = "elPassword666"

  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()
  await users.register({ _id: "b-ob", password })
  await users.get("b-ob")

  await users.login({ _id: "b-ob", password })

  t.throwsAsync(() => users.register({ _id: "b-ob", password }), {
    message: "User already exists.",
  })
  t.throwsAsync(() => users.login({ _id: "b-ob", password: badPassword }), {
    message: "Password does not match.",
  })

  await db.destroy()
  t.pass()
})
