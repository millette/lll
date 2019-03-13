"use strict"

// npm
import test from "ava"
import LevelErrors from "level-errors"

// self
import getDb from "."

test("create and destroy", async (t) => {
  const db = await getDb("./test-db/t1", { errorIfExists: true })
  const table = await db.createTable("bobo")
  t.is(typeof table, "object")
  await db.destroy()
  t.pass()
})

test("get table schema", async (t) => {
  const db = await getDb("./test-db/t2", { errorIfExists: true })

  await db.createTable("bobo")

  const table = await db.getTable("bobo")
  t.is(typeof table, "object")

  await db.close()

  const db2 = await getDb("./test-db/t2", { errorIfExists: false })
  const table2 = await db2.getTable("bobo")
  t.is(typeof table2, "object")

  t.throwsAsync(() => db2.createTable("bobo"), { message: "Table exists." })

  await db2.destroy()
  t.pass()
})

test("create table twice", async (t) => {
  const db = await getDb("./test-db/t3", { errorIfExists: true })
  await db.createTable("bobo")
  t.throwsAsync(() => db.createTable("bobo"), { message: "Table exists." })
  await db.destroy()
  t.pass()
})
