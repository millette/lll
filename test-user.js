"use strict"

// npm
import test from "ava"

// self
import getDb from "."

test("create and destroy", async (t) => {
  const db = await getDb("./test-db/tb1", { errorIfExists: true })
  const users = db.getUsers()
  await users.put({ _id: "b-ob" })
  await db.destroy()
  t.pass()
})
