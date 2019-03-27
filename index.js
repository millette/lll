"use strict"

// core
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

// self
const { hashPassword, checkPassword } = require("./password.js")

// globals
const leveldownDestroy = promisify(leveldown.destroy)
const itKeys = ["gt", "gte", "lt", "lte", "start", "end"]
const POST_END = "\ufff0"
const defaultAjv = { allErrors: true, verbose: true }
const prefixRe = /^[a-z]+$/

/**
 * Initiate a database.
 * @param {string} loc database directory location
 * @param {object} options level and ajv options
 * @returns {object} db instance
 */
const getDb = (loc, options = {}) => {
  assert.equal(loc && typeof loc, "string", "loc argument must be a string.")
  /** Class representing a table. */
  class Table extends EventEmitter {
    /**
     * Create table
     */
    constructor({ db, ajv }, name, { schema, idKey = "_id", access }) {
      // Todo: check that idKey is required by schema
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
      this.tr = through.obj((chunk, enc, callback) => {
        // istanbul ignore next
        if (typeof chunk === "string")
          return callback(null, this.unprefixed(chunk))
        // istanbul ignore next
        if (typeof chunk === "object")
          return callback(null, { ...chunk, key: this.unprefixed(chunk.key) })
        // istanbul ignore next
        callback(new Error("This is not happening!"))
      })
    }

    /*
    getSchema() {
      return this.schema
    }
    */

    prefixed(k = "") {
      // istanbul ignore next
      if (this.db.isClosed()) throw new LevelErrors.OpenError()
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
      // istanbul ignore next
      if (this.db.isClosed()) throw new LevelErrors.WriteError()
      if (typeof k === "object") {
        const key = k[this.idKey]
        // istanbul ignore next
        if (!key) {
          const err = new Error("Missing _id field.")
          err.idKey = this.idKey
          throw err
        }
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
      // istanbul ignore next
      if (this.db.isClosed()) throw new LevelErrors.ReadError("DB is closed.")

      return this.db.get(this.prefixed(k)).then((v) => {
        if (this.access && this.access.get && !this.access.get(user, k, v))
          throw new Error("Cannot get.")
        return v
      })
    }

    _createReadStream(options) {
      // istanbul ignore next
      if (this.db.isClosed()) throw new LevelErrors.ReadError("DB is closed.")
      itKeys.forEach((k) => {
        // istanbul ignore next
        if (options[k]) options[k] = this.prefixed(options[k])
      })
      // istanbul ignore next
      if (!options.gte) options.gte = this.prefixed()
      // istanbul ignore next
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

  /** Class representing the user table. */
  class EmailTable extends Table {
    /**
     * Create email table
     */
    constructor(parent) {
      const schema = {
        required: ["_id", "userId", "email"],
        properties: {
          _id: {
            type: "string",
            format: "email",
          },
          userId: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]{0,61}[a-z0-9]$",
          },
          email: {
            type: "string",
            format: "email",
          },
        },
      }
      super(parent, "_email", { schema })
    }

    async put({ email, userId }) {
      assert(email)
      assert(userId)
      const [name, domain] = email.split("@")
      if (!domain) throw new LevelErrors.WriteError("Malformed email.")
      const _id = `${name.split("+")[0]}@${domain}`.toLowerCase()
      try {
        await super.get(_id)
        throw new LevelErrors.WriteError("Email already exists.")
      } catch (e) {
        if (!(e instanceof LevelErrors.NotFoundError)) throw e
        return super.put({
          _id,
          email,
          userId,
        })
      }
    }
  }

  /** Class representing the user table. */
  class UserTable extends Table {
    /**
     * Create user table
     */
    // constructor(parent, access) {
    constructor(parent, emailRequired) {
      const schema = {
        required: ["_id", "salt", "derivedKey"], // , "email"
        properties: {
          _id: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]{0,61}[a-z0-9]$",
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
        put: (user, k) => user === k,
        get: (user, k) => user === k,
      }
      super(parent, "_user", { access, schema })
      this.emails = new EmailTable(parent)
    }

    async register({ _id, email, password }) {
      try {
        await super.get(_id, _id)
        throw new LevelErrors.WriteError("User already exists.")
      } catch (e) {
        if (!(e instanceof LevelErrors.NotFoundError)) throw e
        if (email) {
          await this.emails.put({ email, userId: _id })
        }

        const user = await hashPassword(password)
        await super.put({ ...user, _id, email }, _id)
        return user
      }
    }

    async login({ _id, password }) {
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
  class Tada extends EventEmitter {
    /**
     * Create a Database instance.
     * @param {object} db
     * @param {function} reject
     * @param {object} ajv
     */
    constructor(db, reject, ajv, emailRequired) {
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
     * @param {object} schema
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

      // istanbul ignore next
      if (!prefixRe.test(name))
        throw new Error("name argument must match ^[a-z]+$")

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
      return this.db.close().then(() => leveldownDestroy(loc))
    }
  }

  const gogo = () =>
    new Promise((resolve, reject) => {
      const db = leveldown(loc)
      let levelOptions
      const { level, ajv, emailRequired, ...rest } = options
      // istanbul ignore next
      if (!level && !ajv) levelOptions = rest
      // istanbul ignore next
      if (level) levelOptions = level
      const ajvOptions = {
        ...defaultAjv,
        ...(ajv || {}),
      }

      db.open(levelOptions, (e) => {
        // istanbul ignore next
        if (e) return reject(e)
        db.close(() => {
          const db2 = levelup(encode(db, { valueEncoding: "json" }))
          const ok = () =>
            resolve(new Tada(db2, reject, new Ajv(ajvOptions), emailRequired))

          db2.once("ready", ok)
          // istanbul ignore next
          db2.once("error", (err) => {
            db2.off("ready", ok)
            reject(err)
          })
        })
      })
    })

  return mkdir(loc).then(gogo)
}

getDb.LevelErrors = LevelErrors

module.exports = getDb
