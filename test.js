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

test("create table with schema", async (t) => {
  const db = await getDb("./test-db/t4", { errorIfExists: true })

  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  const table = await db.createTable("bobo", schema)
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

test("db closing event", (t) => {
  t.plan(1)
  return getDb("./test-db/t6", { errorIfExists: true }).then((db) => {
    db.on("closing", () => t.pass())
    return db.destroy()
  })
})

test("table closing event", (t) => {
  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  t.plan(1)
  return getDb("./test-db/t7", { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", schema)]))
    .then(([db, table]) => {
      table.on("closing", () => t.pass())
      return db.destroy()
    })
})

test("table put event", (t) => {
  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  t.plan(1)
  return getDb("./test-db/t8", { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", schema)]))
    .then(([db, table]) => {
      table.on("put", (k, v) => t.is(k, "it"))
      return Promise.all([db, table.put("it", { want: "more" })])
    })
    .then(([db]) => db.destroy())
})

test("table stream", (t) => {
  t.plan(2)
  return getDb("./test-db/t9", { errorIfExists: true })
    .then((db) =>
      Promise.all([db, db.createTable("bobo"), db.createTable("baba")])
    )
    .then(([db, table1, table2]) =>
      Promise.all([
        db,
        table1,
        table1.put("it", { want: "more1" }),
        table2.put("that", { want: "more2" }),
        table1.put("stuff", { want: "more3" }),
      ])
    )
    .then(
      ([db, table]) =>
        new Promise((resolve) =>
          table
            .createReadStream()
            .on("data", ({ key, value }) => {
              switch (key) {
                case "it":
                  t.is(value.want, "more1")
                  break

                case "stuff":
                  t.is(value.want, "more3")
                  break

                default:
                  t.fail()
              }
            })
            .once("end", () => resolve(db))
        )
    )
    .then((db) => db.destroy())
})

test("tables stream", (t) => {
  t.plan(3)
  return getDb("./test-db/t10", { errorIfExists: true })
    .then((db) =>
      Promise.all([db, db.createTable("bobo"), db.createTable("baba")])
    )
    .then(
      ([db]) =>
        new Promise(async (resolve) => {
          const ret = []
          const str = await db.tablesStream()
          str
            .on("data", ({ key }) => {
              ret.push(key)
              t.pass()
            })
            .once("end", () => {
              t.deepEqual(ret, ["baba", "bobo"])
              resolve(db)
            })
        })
    )
    .then((db) => db.destroy())
})
