"use strict"

// core
const { promisify } = require("util")
const assert = require("assert").strict

// npm
const levelup = require("levelup")
const leveldown = require("leveldown")
const encode = require("encoding-down")
const LevelErrors = require("level-errors")
const through = require("through2")
const Ajv = require("ajv")
const localize = require("ajv-i18n/localize/fr")

const leveldownDestroy = promisify(leveldown.destroy)
const itKeys = ["gt", "gte", "lt", "lte", "start", "end"]
const POST_END = "\ufff0"
const defaultAjv = { allErrors: true, verbose: true }

const getDb = (loc, options = {}) => {
  assert.equal(loc && typeof loc, "string", "loc argument must be a string.")
  class Table {
    constructor({ db, ajv }, name, schema) {
      assert(
        db instanceof levelup,
        "db argument must be an instance of levelup."
      )
      assert(ajv instanceof Ajv, "ajv argument must be an instance of Ajv.")
      assert.equal(
        name && typeof name,
        "string",
        "name argument must be a string."
      )
      this.db = db
      this.name = name
      this.ajv = ajv
      this.validate = schema ? ajv.compile(schema) : () => true
      this.tr = through.obj((chunk, enc, callback) => {
        if (typeof chunk === "string")
          return callback(null, this.unprefixed(chunk))
        if (typeof chunk === "object")
          return callback(null, { ...chunk, key: this.unprefixed(chunk.key) })
        callback(new Error("This is not happening!"))
      })
    }

    prefixed(k = "") {
      if (this.db.isClosed()) throw new LevelErrors.OpenError()
      return `${this.name}:${k}`
    }

    unprefixed(k) {
      assert.equal(k && typeof k, "string", "k argument must be a string.")
      const [a, b] = k.split(":")
      if (!b || a !== this.name) throw new Error("Malformed key.")
      return b
    }

    put(k, v) {
      if (this.db.isClosed()) throw new LevelErrors.WriteError()
      if (!this.validate(v)) {
        localize(this.validate.errors)
        const err = new LevelErrors.WriteError(
          this.ajv.errorsText(this.validate.errors, { separator: "; " })
        )
        err.ajv = this.validate.errors
        throw err
      }
      return this.db.put(this.prefixed(k), v)
    }

    get(k) {
      if (this.db.isClosed()) throw new LevelErrors.ReadError()
      return this.db.get(this.prefixed(k))
    }

    _createReadStream(options) {
      if (this.db.isClosed()) throw new LevelErrors.ReadError()
      itKeys.forEach((k) => {
        if (options[k]) options[k] = this.prefixed(options[k])
      })
      if (!options.gte) options.gte = this.prefixed()
      if (!options.lte) options.lte = this.prefixed(POST_END)
      return this.db.createReadStream(options)
    }

    createReadStream(options = {}) {
      return this._createReadStream(options).pipe(this.tr)
    }

    createKeyStream(options = {}) {
      return this._createReadStream({
        ...options,
        keys: true,
        values: false,
      }).pipe(this.tr)
    }

    createValueStream(options = {}) {
      return this._createReadStream({ ...options, keys: false, values: true })
    }
  }

  class Tada {
    constructor(db, reject, ajv) {
      assert(
        db instanceof levelup,
        "db argument must be an instance of levelup."
      )
      assert.equal(
        typeof reject,
        "function",
        "reject argument must be a function."
      )
      assert(
        !ajv || ajv instanceof Ajv,
        "ajv argument must be an instance of Ajv."
      )
      db.off("error", reject)
      this.db = db
      this.ajv = ajv
    }

    getTable(name) {
      assert.equal(
        name && typeof name,
        "string",
        "name argument must be a string."
      )
    }

    createTable(name, schema) {
      assert.equal(
        name && typeof name,
        "string",
        "name argument must be a string."
      )
      if (schema)
        assert.equal(
          typeof schema,
          "object",
          "schema argument must be an object."
        )
      return new Table(this, name, schema)
    }

    destroy() {
      return this.db.close().then(() => leveldownDestroy(loc))
    }
  }

  return new Promise((resolve, reject) => {
    const db = leveldown(loc)
    let levelOptions
    const { level, ajv, ...rest } = options
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
        const ok = () => resolve(new Tada(db2, reject, new Ajv(ajvOptions)))
        db2.once("ready", ok)
        db2.once("error", (err) => {
          db2.off("ready", ok)
          reject(err)
        })
      })
    })
  })
}

module.exports = getDb
