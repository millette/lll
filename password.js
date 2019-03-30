/**
 * Password module.
 * @module lll/password
 */

"use strict"

// core
const { pbkdf2, randomBytes } = require("crypto")
const assert = require("assert").strict

const ITERATIONS = 10
const KEYLEN = 20
const SALTLEN = 16
const PWMINLEN = 8

/**
 * Verify a password hash.
 * @param {object} obj
 * @param {string} obj.password
 * @param {string} obj.salt
 * @param {string} obj.derivedKey
 * @returns {promise} Rejects on failure
 */
const checkPassword = async ({ hash, password, salt, derivedKey }) => {
  assert.equal(typeof password, "string", "Password must be a string.")
  assert(
    password.length >= PWMINLEN,
    `Password must have at least ${PWMINLEN} chars.`
  )
  if (hash) {
    assert(
      !salt && !derivedKey,
      "Neither salt nor derivedKey should be provided."
    )
  } else {
    assert.equal(typeof derivedKey, "string")
    assert(salt && derivedKey, "Both salt and derivedKey must be provided.")
  }
  return new Promise((resolve, reject) => {
    const hashImp = (saltArg) =>
      pbkdf2(
        password,
        saltArg,
        ITERATIONS,
        KEYLEN,
        "sha1",
        (err, derivedKeyGen) => {
          // Most errors are actually thrown
          // istanbul ignore if
          if (err) return reject(err)
          derivedKeyGen = derivedKeyGen.toString("hex")
          if (!derivedKey)
            return resolve({ derivedKey: derivedKeyGen, salt: saltArg })
          if (derivedKey !== derivedKeyGen)
            return reject(new Error("Password does not match."))
          resolve()
        }
      )

    if (!hash) return hashImp(salt)

    randomBytes(SALTLEN, (err, salt) => {
      // Most errors are actually thrown
      // istanbul ignore if
      if (err) return reject(err)
      hashImp(salt.toString("hex"))
    })
  })
}

/**
 * Hash a password.
 * @param {string} password
 * @returns {promise} Object with salt and derivedKey fields
 */
const hashPassword = (password) => checkPassword({ password, hash: true })

module.exports = { hashPassword, checkPassword }
