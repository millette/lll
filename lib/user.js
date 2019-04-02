/*
 * lll module.
 * @module lll
 */

"use strict"

// core
const { randomBytes } = require("crypto")

// npm
const LevelErrors = require("level-errors")

// self
const rules = require("./rules.js")
const { hashPassword, checkPassword } = require("./password.js")
const Table = require("./table.js")
const EmailTable = require("./email.js")

const TOKENLEN = 12
const TOKENMINUTES = 120

const makeToken = async () =>
  new Promise((resolve, reject) =>
    randomBytes(TOKENLEN, (err, salt) => {
      // Most errors are actually thrown
      // istanbul ignore if
      if (err) return reject(err)
      resolve(salt.toString("hex"))
    })
  )

/** Class representing the user table. */
class UserTable extends Table {
  constructor(parent, emailRequired) {
    const schema = {
      required: ["_id", "salt", "derivedKey", "reset"],
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
        reset: {
          type: "object",
          default: {},
          properties: {
            token: {
              type: "string",
              pattern: "^[a-f0-9]{24}$",
            },

            validUntil: {
              type: "string",
              format: "date-time",
            },
          },
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
      } else {
        email = undefined
      }

      const user = await hashPassword(password)
      await super.put({ ...user, _id, email, origId }, _id)
      return user
    }
  }

  async idOrEmailToUser({ _id, email }) {
    if (!_id && !email) throw new Error("Email or _id required.")
    if (!email && _id.indexOf("@") !== -1) email = _id
    if (email) {
      const oy = await this.emails.get(email)
      _id = oy.userId
    } else {
      _id = _id.toLowerCase()
    }
    return super.get(_id, _id)
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
    const user = await this.idOrEmailToUser({ _id, email })
    await checkPassword({ ...user, password })
    return user._id
  }

  async changePassword({ _id, password, email }) {
    const { reset, ...user } = await this.idOrEmailToUser({ _id, email })
    const user2 = await hashPassword(password)
    return super.put(
      {
        ...user,
        ...user2,
      },
      user._id
    )
  }

  async useToken({ _id, email, token, password }) {
    if (!token) throw new Error("Invalid token.")
    if (!password) throw new Error("New password must be supplied.")
    const {
      reset: { token: token2, validUntil },
      ...user
    } = await this.idOrEmailToUser({ _id, email })
    const now = new Date().toISOString()
    if (token !== token2 || validUntil < now) throw new Error("Invalid token.")
    const user2 = await hashPassword(password)
    return super.put(
      {
        ...user,
        ...user2,
      },
      user._id
    )
  }

  async resetPassword({ _id, email, validFor = TOKENMINUTES }) {
    const user = await this.idOrEmailToUser({ _id, email })
    if (user.reset.token) return user.reset.token
    const token = await makeToken()
    const reset = {
      token,
      validUntil: new Date(Date.now() + validFor * 60 * 1000).toISOString(),
    }
    await super.put({ ...user, reset }, user._id)
    return token
  }

  get() {
    return Promise.reject(new Error("UserTable.get() is not implemented."))
  }

  put() {
    return Promise.reject(new Error("UserTable.put() is not implemented."))
  }
}

module.exports = UserTable
