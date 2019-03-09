"use strict"

// self
const getDb = require(".")

const run = async (fn, options) => {
  const db666 = await getDb(fn, options)
  const db = db666.createTable("bobo")

  const schema = {
    // required: ['smaller'],
    properties: {
      smaller: {
        type: "number",
        maximum: 5,
        // "maximum": { "$data": "1/larger" }
      },
      larger: {
        type: "number",
      },
    },
  }

  const db2 = db666.createTable("roger", schema)

  await db.put("oy", "b555o")
  await db.put("bb", 42)
  await db.put("ob", { n: 42 })
  await db.put("dd", new Date())

  // await db2.put('oy', 'b555og')
  // await db2.put('bb', 423)
  // await db2.put('ob', { n: 423 })
  await db2.put("ob7", { smaller7: 11, larger5: "bob" })
  await db2.put("zz", { smaller4: 4 })

  db2
    .createReadStream()
    // db2.createValueStream()
    // db2.createKeyStream()
    .on("data", (d) => {
      console.log("DATA:", d)
    })
    .on("end", () => {
      db666.destroy().catch((e) => {
        console.error("DESTROY", e)
      })
    })
}

module.exports = run
