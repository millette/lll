"use strict"

// core
// const { promisify, inherits } = require("util")
const { promisify } = require("util")
const assert = require("assert").strict
const { EventEmitter } = require("events")

// npm
const levelup = require("levelup")
const leveldown = require("leveldown")
const encode = require("encoding-down")
const LevelErrors = require("level-errors")
const through = require("through2")
const Ajv = require("ajv")
const localize = require("ajv-i18n/localize/fr")
const mkdir = require("make-dir")
const schemaSchema = require("ajv/lib/refs/json-schema-secure.json")

/*
class LevelupMine extends levelup {
  emit(a, b, c, d) {
    // console.log('EMIT', a, b, c, d)
    super.emit('*', a)
    return super.emit(a, b, c, d)
  }
}
*/

const leveldownDestroy = promisify(leveldown.destroy)
const itKeys = ["gt", "gte", "lt", "lte", "start", "end"]
const POST_END = "\ufff0"
const defaultAjv = { allErrors: true, verbose: true }

const getDb = (loc, options = {}) => {
  assert.equal(loc && typeof loc, "string", "loc argument must be a string.")
  class Table extends EventEmitter {
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
      super()
      this.db = db

      this.name = name

      this.db.on("closing", () => this.emit("closing"))

      this.db.on("put", (b, c) => {
        // console.log('PUT', b, c, this.name, this.unprefixed(b))
        // this.emit('put', this.unprefixed(b), c)
        // console.log('PUT', b, c, this.name)

        try {
          this.emit("put", this.unprefixed(b), c)
        } catch (e) {
          // console.log('Do not care for', b, this.name)
        }

        this.emit("put", b, c)
      })

      this.ajv = ajv
      this.schema = schema
      this.validate = schema ? ajv.compile(schema) : () => true
      this.tr = through.obj((chunk, enc, callback) => {
        if (typeof chunk === "string")
          return callback(null, this.unprefixed(chunk))
        if (typeof chunk === "object")
          return callback(null, { ...chunk, key: this.unprefixed(chunk.key) })
        callback(new Error("This is not happening!"))
      })
    }

    getSchema() {
      return this.schema
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

  class Tada extends EventEmitter {
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
      super()
      this.db = db
      this.ajv = ajv
      this.tables = new Map()
      this.schemas = new Table(this, "_table", schemaSchema)
    }

    on(a, b, c, d) {
      // console.log('ON', a, b, c, d)
      return this.db.on(a, b, c, d)
    }

    once(a, b, c, d) {
      return this.db.once(a, b, c, d)
    }

    off(a, b, c, d) {
      return this.db.off(a, b, c, d)
    }

    close() {
      return this.db.close()
    }

    async getTable(name) {
      assert.equal(
        name && typeof name,
        "string",
        "name argument must be a string."
      )
      const table = this.tables.get(name)
      if (table) return table
      return this.schemas
        .get(name)
        .then((schema) => new Table(this, name, schema))
    }

    async createTable(name, schema) {
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

      if (this.tables.get(name)) throw new Error("Table exists.")

      return this.schemas
        .get(name)
        .then(() => {
          throw new Error("Table exists.")
        })
        .catch((e) => {
          if (e instanceof LevelErrors.NotFoundError) return
          throw e
        })
        .then(() => {
          const table = new Table(this, name, schema)
          this.tables.set(name, table)
          return Promise.all([table, this.schemas.put(name, schema || false)])
        })
        .then(([table]) => table)
    }

    destroy() {
      return this.db.close().then(() => leveldownDestroy(loc))
    }
  }

  const gogo = () =>
    new Promise((resolve, reject) => {
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
          // const db2 = new LevelupMine(encode(db, { valueEncoding: "json" }))
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

  return mkdir(loc).then(gogo)
}

module.exports = getDb
