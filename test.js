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

  // db.on('*', (ev) => console.log('EVENT:', ev))
  // db.on('put', (b, c) => console.log('EVENT-PUT:', b, c))

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

test("create table with schema", async (t) => {
  const db = await getDb("./test-db/t4", { errorIfExists: true })

  // db.on('*', (ev) => console.log('EVENT:', ev))

  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  const table = await db.createTable("bobo", schema)

  db.on("closing", (ev) => console.log("CLOSING DB"))
  table.on("closing", (ev) => console.log("CLOSING TABLE"))
  table.on("put", (b, c) => console.log("TABLE-PUT:", b, c))

  await table.put("thing", { joe: "blow" })

  try {
    await table.put("thing2", { smaller: "blow" })
  } catch (e) {
    t.truthy(e instanceof LevelErrors.WriteError)
    const ajvError = e.ajv[0]
    t.is(ajvError.schemaPath, "#/properties/smaller/type")
    t.is(ajvError.dataPath, ".smaller")
  }

  await db.destroy()
  t.pass()
})

test("create table with bad schema", async (t) => {
  const db = await getDb("./test-db/t5", { errorIfExists: true })

  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: { $data: "1/larger" },
      },
    },
  }

  t.throwsAsync(() => db.createTable("bobo", schema), {
    message:
      "schema is invalid: data.properties['smaller'].maximum should be number",
  })

  await db.destroy()
  t.pass()
})

test.cb("db closing event", (t) => {
  t.plan(1)
  getDb("./test-db/t6", { errorIfExists: true })
    .then((db) => {
      db.on("closing", () => t.pass())
      return db.destroy()
    })
    .then(() => t.end())
})

test.cb("table closing event", (t) => {
  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  t.plan(1)
  getDb("./test-db/t7", { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", schema)]))
    .then(([db, table]) => {
      table.on("closing", () => t.pass())
      return db.destroy()
    })
    .then(() => t.end())
})

test.cb("table put event", (t) => {
  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  t.plan(1)
  getDb("./test-db/t8", { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", schema)]))
    .then(([db, table]) => {
      table.on("put", (k, v) => t.is(k, "it"))
      return Promise.all([db, table.put("it", { want: "more" })])
    })
    .then(([db]) => db.destroy())
    .then(() => t.end())
})
