/*
 * lll module.
 * @module lll
 */

"use strict"
// expected arguments: fn(user, k, v) => ...
const rules = {
  anyUser: Boolean,
  userKey: (user, k) => user === k,
}

module.exports = rules
