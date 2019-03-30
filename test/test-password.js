"use strict"

// core
import { AssertionError } from "assert"

// npm
import test from "ava"

// self
import { hashPassword, checkPassword, PWMINLEN } from "../password.js"

test("hashPassword (1)", async (t) =>
  t.throwsAsync(() => hashPassword("1234567"), {
    instanceOf: AssertionError,
    message: `Password must have at least ${PWMINLEN} chars.`,
  }))

test("hashPassword (2)", async (t) => {
  await hashPassword("12345678")
  t.pass()
})

test("checkPassword (1)", async (t) => {
  const password = "12345678"
  const salt = "d030a50306380fa49c97ba7b4ff0cac9"
  const derivedKey = "a6fdfc109c63f2f970b655fa514a3482cbfbcb15"

  await checkPassword({ password, salt, derivedKey })
  t.pass()
})

test("checkPassword (2)", async (t) =>
  t.throwsAsync(
    () => checkPassword({ password: "12345678", salt: "a", derivedKey: "" }),
    {
      instanceOf: AssertionError,
      message: "Both salt and derivedKey must be provided.",
    }
  ))

test("checkPassword (3)", async (t) =>
  t.throwsAsync(
    () =>
      checkPassword({
        password: "123456789",
        salt: "d030a50306380fa49c97ba7b4ff0cac9",
        derivedKey: "a6fdfc109c63f2f970b655fa514a3482cbfbcb15",
      }),
    {
      message: "Password does not match.",
    }
  ))

test("checkPassword (4)", async (t) =>
  t.throwsAsync(
    () =>
      checkPassword({
        password: "1234567",
        salt: "d030a50306380fa49c97ba7b4ff0cac9",
        derivedKey: "a6fdfc109c63f2f970b655fa514a3482cbfbcb15",
      }),
    {
      instanceOf: AssertionError,
      message: `Password must have at least ${PWMINLEN} chars.`,
    }
  ))

test("checkPassword (5)", async (t) =>
  t.throwsAsync(
    () =>
      checkPassword({
        password: "12345678",
        salt: 1234,
        derivedKey: "a6fdfc109c63f2f970b655fa514a3482cbfbcb15",
      }),
    {
      instanceOf: TypeError,
      message:
        'The "salt" argument must be one of type string, Buffer, TypedArray, or DataView. Received type number',
    }
  ))

test("checkPassword (6)", async (t) =>
  t.throwsAsync(
    () =>
      checkPassword({
        password: "12345678",
        salt: "d030a50306380fa49c97ba7b4ff0cac9",
        derivedKey: true,
      }),
    {
      instanceOf: AssertionError,
    }
  ))
