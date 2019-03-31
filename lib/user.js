/*
 * lll module.
 * @module lll
 */

"use strict"

// npm
const LevelErrors = require("level-errors")

// self
const rules = require("./rules.js")
const { hashPassword, checkPassword } = require("./password.js")
const Table = require("./table.js")
const EmailTable = require("./email.js")

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

module.exports = UserTable
