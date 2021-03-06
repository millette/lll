"use strict"

// npm
import test from "ava"
import LevelErrors from "level-errors"

// self
import getDb from ".."
import { beforeEach, afterEach } from "./_helpers"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("bad location", async (t) => {
  delete t.context
  return t.throwsAsync(
    () => getDb("/never/write/here", { errorIfExists: true }),
    {
      code: "EACCES",
      message: /^EACCES: permission denied, mkdir/,
    }
  )
})

test("open same db twice", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  await db.close()
  t.pass()

  await t.throwsAsync(() => getDb(t.context.loc, { errorIfExists: true }), {
    name: "Error",
    message: `Invalid argument: ${t.context.loc}: exists (error_if_exists is true)`,
  })

  await db.destroy()
  t.pass()
})

test("get table schema", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  await db.createTable("bobo")
  const table = await db.getTable("bobo")
  t.is(typeof table, "object")
  await db.close()

  const db2 = await getDb(t.context.loc)
  const table2 = await db2.getTable("bobo")
  t.is(typeof table2, "object")
  t.throwsAsync(() => db2.createTable("bobo"), { message: "Table exists." })

  await db2.destroy()
  t.pass()
})

test("bad table name", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  await db.createTable("bo-bo")
  await t.throwsAsync(() => db.createTable("bo bo"), {
    instanceOf: LevelErrors.WriteError,
    message: "Malformed table name.",
  })
  await t.throwsAsync(() => db.createTable("-bobo"), {
    instanceOf: LevelErrors.WriteError,
    message: "Malformed table name.",
  })
  await db.destroy()
  t.pass()
})

test("early close (1)", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  await db.close()
  t.throwsAsync(() => db.createTable("bobo"), {
    instanceOf: LevelErrors.ReadError,
    message: "Database is not open",
  })
  await db.destroy()
  t.pass()
})

test("early close (2)", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  const table = await db.createTable("bobo")
  await db.close()
  t.throwsAsync(() => table.put("bobo", "baba"), {
    instanceOf: LevelErrors.ReadError,
    message: "Database is not open",
  })
  await db.destroy()
  t.pass()
})

test("create table twice", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  await db.createTable("bobo")
  t.throwsAsync(() => db.createTable("bobo"), { message: "Table exists." })
  await db.destroy()
  t.pass()
})

test("create table with schema (with idKey)", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })

  const schema = {
    required: ["smaller"],
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  const table = await db.createTable("bobo", { schema, idKey: "smaller" })
  await table.put({ smaller: 4.99 })
  await db.destroy()
  t.pass()
})

test("create table with schema", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })

  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
      },
    },
  }

  const table = await db.createTable("bobo", { schema })
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
  const db = await getDb(t.context.loc, { errorIfExists: true })

  const schema = {
    properties: {
      smaller: {
        type: "number",
        maximum: { $data: "1/larger" },
      },
    },
  }

  t.throwsAsync(() => db.createTable("bobo", { schema }), {
    message:
      "schema is invalid: data.properties['smaller'].maximum should be number",
  })

  await db.destroy()
  t.pass()
})

test("db closing event", (t) => {
  t.plan(1)
  return getDb(t.context.loc, { errorIfExists: true }).then((db) => {
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
  return getDb(t.context.loc, { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", { schema })]))
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
  return getDb(t.context.loc, { errorIfExists: true })
    .then((db) => Promise.all([db, db.createTable("bobo", { schema })]))
    .then(([db, table]) => {
      table.on("put", (k, v) => t.is(k, "it"))
      return Promise.all([db, table.put("it", { want: "more" })])
    })
    .then(([db]) => db.destroy())
})

test("table stream", (t) => {
  t.plan(2)
  return getDb(t.context.loc, { errorIfExists: true })
    .then((db) =>
      Promise.all([db, db.createTable("bobo"), db.createTable("baba")])
    )
    .then(([db, table1, table2]) =>
      Promise.all([
        db,
        table1,
        table2,
        table1.put("it", { want: "more1" }),
        table2.put("that", "more2"),
        table1.put("stuff", { want: "more3" }),
      ])
    )
    .then(
      ([db, table, table2]) =>
        new Promise((resolve) =>
          table
            .createReadStream({ gte: "j", lte: "t" })
            .on("data", ({ key, value }) => {
              switch (key) {
                /*
                case "it":
                  t.is(value.want, "more1")
                  break
                */

                case "stuff":
                  t.is(value.want, "more3")
                  break

                default:
                  t.fail()
              }
            })
            .once("end", () => resolve([db, table2]))
        )
    )
    .then(
      ([db, table]) =>
        new Promise((resolve) =>
          table
            .createReadStream()
            .on("data", ({ key, value }) => {
              switch (key) {
                case "that":
                  t.is(value, "more2")
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
  return getDb(t.context.loc, { errorIfExists: true })
    .then((db) =>
      Promise.all([db, db.createTable("bobo"), db.createTable("baba")])
    )
    .then(
      ([db]) =>
        // new Promise(async (resolve) => {
        new Promise((resolve) => {
          const ret = []
          // const str = await db.tablesStream()
          db.tablesStream().then((str) => {
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
        })
    )
    .then((db) => db.destroy())
})
