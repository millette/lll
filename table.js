/*
 * lll module.
 * @module lll
 */

"use strict"

// core
const assert = require("assert").strict
const { EventEmitter } = require("events")

// npm
const levelup = require("levelup")
const LevelErrors = require("level-errors")
const through = require("through2")
const Ajv = require("ajv")
const localize = require("ajv-i18n/localize/fr")

// globals
const itKeys = ["gt", "gte", "lt", "lte", "start", "end"]
const POST_END = "\ufff0"

/** Class representing a table. */
class Table extends EventEmitter {
  // FIXME: jsdoc shows $0, $2... instead of names
  /**
   * @param {object} internal.db
   * @param {object} internal.ajv
   * @param {string} name
   * @param {object} options.schema
   * @param {string} options.idKey
   * @param {object} options.access
   */
  constructor({ db, ajv }, name, { schema, idKey = "_id", access }) {
    // Todo: check that idKey is required by schema
    assert(db instanceof levelup, "db argument must be an instance of levelup.")
    assert(ajv instanceof Ajv, "ajv argument must be an instance of Ajv.")
    assert.equal(
      name && typeof name,
      "string",
      "name argument must be a string."
    )
    super()
    this.db = db
    this.name = name
    this.idKey = idKey
    this.access = access
    this.db.on("closing", () => this.emit("closing"))
    this.db.on("put", (key, value) => {
      try {
        this.emit("put", this.unprefixed(key), value)
      } catch (e) {}
    })

    if (!schema) schema = {}

    this.ajv = ajv
    this.schema = schema
    this.validate = ajv.compile(schema)
    this.tr = through.obj(({ key, value }, enc, callback) =>
      callback(null, { value, key: this.unprefixed(key) })
    )
  }

  /*
  getSchema() {
    return this.schema
  }
  */

  prefixed(k = "") {
    return `${this.name}:${k}`
  }

  unprefixed(k) {
    assert.equal(k && typeof k, "string", "k argument must be a string.")
    const [a, b] = k.split(":")
    if (!b || a !== this.name) throw new Error("Malformed key.")
    return b
  }

  /** Put item in table. */
  async put(k, v, user) {
    if (typeof k === "object") {
      const key = k[this.idKey]
      // FIXME: necessary precaution?
      /*
      if (!key) {
        const err = new Error("Missing _id field.")
        err.idKey = this.idKey
        throw err
      }
      */
      user = v
      v = k
      k = key
    }

    if (this.access && this.access.put && !this.access.put(user, k, v))
      throw new Error("Cannot put.")

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

  /** Get item from table. */
  get(k, user) {
    return this.db.get(this.prefixed(k)).then((v) => {
      if (this.access && this.access.get && !this.access.get(user, k, v))
        throw new Error("Cannot get.")
      return v
    })
  }

  _createReadStream(options) {
    itKeys.forEach((k) => {
      if (options[k]) options[k] = this.prefixed(options[k])
    })
    if (!options.gte) options.gte = this.prefixed()
    if (!options.lte) options.lte = this.prefixed(POST_END)
    return this.db.createReadStream(options)
  }

  /** Create readable stream. */
  createReadStream(options = {}) {
    return this._createReadStream(options).pipe(this.tr)
  }

  /*
  createKeyStream(options = {}) {
    return this._createReadStream({
      ...options,
      keys: true,
      values: false,
    }).pipe(this.tr)
  }
  */

  /*
  createValueStream(options = {}) {
    return this._createReadStream({ ...options, keys: false, values: true })
  }
  */
}

module.exports = Table
