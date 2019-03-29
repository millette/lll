/**
 * lll module.
 * @module lll
 */

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
const prefixRe = /^([a-z][a-z-]{0,61}[a-z]|[a-z]{1,63})$/

// expected arguments: fn(user, k, v) => ...
const rules = {
  anyUser: Boolean,
  userKey: (user, k) => user === k,
}

const emailUnalias = (email) => {
  const [name, domain] = email.split("@")
  if (!domain) throw new LevelErrors.WriteError("Malformed email.")
  return `${name.split("+")[0]}@${domain}`.toLowerCase()
}

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

  /** Class representing the email table. */
  class EmailTable extends Table {
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

    async get(email) {
      return super.get(emailUnalias(email))
    }

    async put({ email, userId }) {
      assert(email)
      assert(userId)

      try {
        await this.get(email)
        throw new LevelErrors.WriteError("Email already exists.")
      } catch (e) {
        if (!(e instanceof LevelErrors.NotFoundError)) throw e
        return super.put({
          _id: emailUnalias(email),
          email,
          userId,
        })
      }
    }
  }

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
      return this.db.close().then(() => leveldownDestroy(loc))
    }
  }

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
            resolve(new DB(db2, reject, new Ajv(ajvOptions), emailRequired))

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

getDb.LevelErrors = LevelErrors

module.exports = getDb
