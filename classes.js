/*
 * lll module.
 * @module lll
 */

"use strict"

// core
const { promisify } = require("util")
const assert = require("assert").strict
const { EventEmitter } = require("events")

// npm
const LevelErrors = require("level-errors")
const levelup = require("levelup")
const leveldown = require("leveldown")
const Ajv = require("ajv")
const schemaSchema = require("ajv/lib/refs/json-schema-secure.json")

// self
const Table = require("./table.js")
const UserTable = require("./user.js")

// globals
const leveldownDestroy = promisify(leveldown.destroy)
const prefixRe = /^([a-z][a-z-]{0,61}[a-z]|[a-z]{1,63})$/

/** Database class. */
class DB extends EventEmitter {
  /**
   * @param {object} db
   * @param {object} ajv
   */
  // constructor(db, reject, ajv, emailRequired) {
  constructor(db, ajv, emailRequired) {
    assert(db instanceof levelup, "db argument must be an instance of levelup.")
    /*
    assert.equal(
      typeof reject,
      "function",
      "reject argument must be a function."
    )
    */
    assert(
      !ajv || ajv instanceof Ajv,
      "ajv argument must be an instance of Ajv."
    )

    // db.off("error", reject)
    super()
    this.db = db
    this.ajv = ajv
    this.tables = new Map()
    this.schemas = new Table(this, "_table", { schema: schemaSchema })
    this.users = new UserTable(this, emailRequired)
  }

  getUsers() {
    return this.users
  }

  /**
   * Add event listener.
   */
  on(a, b, c, d) {
    return this.db.on(a, b, c, d)
  }

  /*
  once(a, b, c, d) {
    return this.db.once(a, b, c, d)
  }
  */

  /*
  off(a, b, c, d) {
    return this.db.off(a, b, c, d)
  }
  */

  /** Close database. */
  close() {
    return this.db.close()
  }

  /** Return stream of tables. */
  async tablesStream() {
    return this.schemas.createReadStream()
  }

  /**
   * Return table by name.
   * @param {string} name
   * @returns {Table}
   */
  async getTable(name) {
    assert.equal(
      name && typeof name,
      "string",
      "name argument must be a string."
    )
    const table = this.tables.get(name)
    if (table) return table
    return this.schemas.get(name).then((ret) => new Table(this, name, ret))
  }

  /**
   * Create table.
   * @param {string} name
   * @param {object} options
   * @param {object} options.schema
   * @param {object} options.access
   * @param {string} options.idKey
   * @returns {Table}
   */
  async createTable(name, { schema, idKey, access } = {}) {
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

    if (!prefixRe.test(name))
      throw new LevelErrors.WriteError("Malformed table name.")

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
        const table = new Table(this, name, { access, schema, idKey })
        this.tables.set(name, table)
        return Promise.all([table, this.schemas.put(name, schema || false)])
      })
      .then(([table]) => table)
  }

  /** Destroy database. */
  destroy() {
    return this.db.close().then(() => leveldownDestroy(this.db._db.db.location))
  }
}

module.exports = DB
