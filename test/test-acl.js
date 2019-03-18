"use strict"

// npm
import test from "ava"

// self
import getDb from ".."
import { beforeEach, afterEach } from "./_helpers.js"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("acl", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })

  const access = {
    put: false,
  }

  const t1 = await db.createTable("bobo", { access })

  await t1.put("joe", "blow")

  const i1 = await t1.get("joe")
  console.log("i1:", i1)

  await db.destroy()
  t.pass()
})
