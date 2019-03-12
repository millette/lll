"use strict"

// npm
import test from "ava"

// self
import getDb from "."

test("create and destroy", async (t) => {
  const db = await getDb("./test-db/t1", { errorIfExists: true })
  const table = db.createTable("bobo")
  t.is(typeof table, "object")
  await db.destroy()
  t.pass()
})

test.only("get table schema", async (t) => {
  const db = await getDb("./test-db/t2", { errorIfExists: true })

  await db.createTable("bobo")

  const table = await db.getTable("bobo")
  t.is(typeof table, "object")

  await db.close()

  const db2 = await getDb("./test-db/t2", { errorIfExists: false })
  const table2 = await db2.getTable("bobo")
  t.is(typeof table2, "object")

  await db2.destroy()
  t.pass()
})
