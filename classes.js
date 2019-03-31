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
// const localize = require("ajv-i18n/localize/fr")
const schemaSchema = require("ajv/lib/refs/json-schema-secure.json")

// self
const { hashPassword, checkPassword } = require("./password.js")
const rules = require("./rules.js")
const Table = require("./table.js")
const EmailTable = require("./email.js")

// globals
const leveldownDestroy = promisify(leveldown.destroy)
const prefixRe = /^([a-z][a-z-]{0,61}[a-z]|[a-z]{1,63})$/

/** Class representing the user table. */
class UserTable extends Table {
  constructor(parent, emailRequired) {
    const schema = {
      required: ["_id", "salt", "derivedKey"],
      properties: {
        _id: {
          type: "string",
          pattern: "^([a-z][a-z-]{0,61}[a-z]|[a-z]{1,63})$",
        },
        salt: {
          type: "string",
          pattern: "^[a-f0-9]{32}$",
        },
        derivedKey: {
          type: "string",
          pattern: "^[a-f0-9]{40}$",
        },
        email: {
          type: "string",
          format: "email",
        },
      },
    }
    if (emailRequired) schema.required.push("email")
    const access = {
      put: rules.userKey,
      get: rules.userKey,
    }
    super(parent, "_user", { access, schema })
    this.emails = new EmailTable(parent)
  }

  /**
   * Create (register) new user.
   * @param {object} options
   * @param {string} options._id
   * @param {string} options.password
   * @param {string} options.email
   * @returns {promise} user object
   */
  async register({ _id, password, email }) {
    const origId = _id
    _id = _id.toLowerCase()
    try {
      await super.get(_id, _id)
      throw new LevelErrors.WriteError("User already exists.")
    } catch (e) {
      if (!(e instanceof LevelErrors.NotFoundError)) throw e
      if (email) {
        await this.emails.put({ email, userId: _id })
      }

      const user = await hashPassword(password)
      await super.put({ ...user, _id, email, origId }, _id)
      return user
    }
  }

  /**
   * Login (verify user password).
   * @param {object} options
   * @param {string} options._id
   * @param {string} options.password
   * @param {string} options.email
   * @returns {promise} Rejects if bad user or password
   */
  async login({ _id, password, email }) {
    if (!email && _id.indexOf("@") !== -1) email = _id
    if (email) {
      const oy = await this.emails.get(email)
      _id = oy.userId
    } else {
      _id = _id.toLowerCase()
    }
    const user = await super.get(_id, _id)
    return checkPassword({ ...user, password })
  }

  // changePassword(user) {}
  // resetPassword(user) {}

  get() {
    return Promise.reject(new Error("UserTable.get() is not implemented."))
  }

  put() {
    return Promise.reject(new Error("UserTable.put() is not implemented."))
  }
}

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
