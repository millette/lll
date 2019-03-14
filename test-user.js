"use strict"

// npm
import test from "ava"

// self
import getDb from "."
import zaza from "./helpers-test.js"

test.beforeEach(async (t) => {
  t.context.loc = await zaza()
})

test("create and destroy", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()
  await users.put({ _id: "b-ob" })
  await db.destroy()
  t.pass()
})
