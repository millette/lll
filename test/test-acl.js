"use strict"

// npm
import test from "ava"

// self
import getDb from ".."
import { beforeEach, afterEach } from "./_helpers"

test.beforeEach(beforeEach)
test.afterEach.always(afterEach)

test("acl get, user required", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  const access = { get: Boolean }
  const t1 = await db.createTable("bobo", { access })
  await t1.put("joe", "blow")
  t.throwsAsync(t1.get("joe"), { message: "Cannot get." })
  const v = await t1.get("joe", "ron")
  t.is(v, "blow")
  await db.destroy()
  t.pass()
})

test("acl put, user required", async (t) => {
  const db = await getDb(t.context.loc, { errorIfExists: true })
  const access = { put: Boolean }
  const t1 = await db.createTable("bobo", { access })
  t.throwsAsync(t1.put("joe", "blow"), { message: "Cannot put." })

  await t1.put("joe", "blow", "ron")
  await db.destroy()
  t.pass()
})
