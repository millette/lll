"use strict"

// core
const { pbkdf2, randomBytes } = require("crypto")

const ITERATIONS = 10
const KEYLEN = 20
const SALTLEN = 16

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
    if (salt || derivedKey)
      return reject(new Error("Both salt and derivedKey must be provided."))
    randomBytes(SALTLEN, (err, salt) => {
      if (err) return reject(err)
      hashImp(salt.toString("hex"))
    })
  })

const hashPassword = (password) => checkPassword({ password })

module.exports = { hashPassword, checkPassword }
