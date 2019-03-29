/**
 * Password module.
 * @module lll/password
 */

"use strict"

// core
const { pbkdf2, randomBytes } = require("crypto")

const ITERATIONS = 10
const KEYLEN = 20
const SALTLEN = 16

/**
 * Verify a password hash.
 * @param {object} obj
 * @param {string} obj.password
 * @param {string} obj.salt
 * @param {string} obj.derivedKey
 * @returns {promise} Rejects on failure
 */
const checkPassword = ({ password, salt, derivedKey }) =>
  new Promise((resolve, reject) => {
    const hashImp = (saltArg) =>
      pbkdf2(
        password,
        saltArg,
        ITERATIONS,
        KEYLEN,
        "sha1",
        (err, derivedKeyGen) => {
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

    if (salt && derivedKey) return hashImp(salt)

    // FIXME: necessary precaution?
    // if (salt || derivedKey) return reject(new Error("Both salt and derivedKey must be provided."))

    randomBytes(SALTLEN, (err, salt) => {
      // istanbul ignore if
      if (err) return reject(err)
      hashImp(salt.toString("hex"))
    })
  })

/**
 * Hash a password.
 * @param {string} password
 * @returns {promise} Object with salt and derivedKey fields
 */
const hashPassword = (password) => checkPassword({ password })

module.exports = { hashPassword, checkPassword }
