"use strict"

// npm
import test from "ava"

// self
import getDb from "."
import { beforeEach, afterEach } from "./helpers-test.js"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("create and destroy", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  const users = db.getUsers()
  await users.put({ _id55: "b-ob" })
  await db.destroy()
  t.pass()
})
