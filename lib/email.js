/*
 * lll module.
 * @module lll
 */

"use strict"

// core
const assert = require("assert").strict

// npm
const LevelErrors = require("level-errors")

// self
const Table = require("./table.js")

const emailUnalias = (email) => {
  const [name, domain] = email.split("@")
  if (!domain) throw new LevelErrors.WriteError("Malformed email.")
  return `${name.split("+")[0]}@${domain}`.toLowerCase()
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
          pattern: "^([a-z][a-z-]{0,61}[a-z]|[a-z]{1,63})$",
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

module.exports = EmailTable
