"use strict"

// npm
import test from "ava"

// self
import getDb from "."

test("create and destroy", async (t) => {
  const db = await getDb("./test-db/t1", { errorIfExists: true })
  db.createTable("bobo")
  await db.destroy()
  t.pass()
})

test.skip("get table schema", async (t) => {
  const db = await getDb("./test-db/t2", { errorIfExists: true })
  const tableBobo = db.createTable("bobo")
  console.log("tableBobo", tableBobo.getSchema())
  await db.close()
  console.log("after close")

  const db2 = await getDb("./test-db/t2", { errorIfExists: false })
  console.log("after 2nd open")

  const tableBobo2 = db2.getTable("bobo")
  console.log("tableBobo2", tableBobo2.getSchema())

  await db2.destroy()
  console.log("after destroy")
  t.pass()
})
