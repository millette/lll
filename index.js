/**
 * lll module.
 * @module lll
 */

"use strict"

// core
const assert = require("assert").strict

// npm
const levelup = require("levelup")
const leveldown = require("leveldown")
const encode = require("encoding-down")
const Ajv = require("ajv")
const mkdir = require("make-dir")

// self
const DB = require("./lib/db.js")
const rules = require("./lib/rules.js")

// globals
const defaultAjv = { allErrors: true, verbose: true }

/**
 * Initiate a database.
 * @param {string} loc database directory location
 * @param {object} options
 * @param {object} options.level
 * @param {object} options.ajv
 * @param {boolean} options.emailRequired
 * @returns {object} db instance
 */
const getDb = (loc, options = {}) => {
  assert.equal(loc && typeof loc, "string", "loc argument must be a string.")

  const open = () =>
    new Promise((resolve, reject) => {
      const db = leveldown(loc)
      let levelOptions
      const { level, ajv, emailRequired, ...rest } = options
      if (!level && !ajv) levelOptions = rest
      if (level) levelOptions = level
      const ajvOptions = {
        ...defaultAjv,
        ...(ajv || {}),
      }

      db.open(levelOptions, (e) => {
        if (e) return reject(e)
        db.close(() => {
          const db2 = levelup(encode(db, { valueEncoding: "json" }))
          const ok = () =>
            // resolve(new DB(db2, reject, new Ajv(ajvOptions), emailRequired))
            resolve(new DB(db2, new Ajv(ajvOptions), emailRequired))

          db2.once("ready", ok)
          // FIXME: necessary precaution?
          /*
          db2.once("error", (err) => {
            console.error('Oh well.....')
            db2.off("ready", ok)
            reject(err)
          })
          */
        })
      })
    })

  return mkdir(loc).then(open)
}

getDb.rules = rules

module.exports = getDb
