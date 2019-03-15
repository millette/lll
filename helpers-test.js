"use strict"

// core
const { sep } = require("path")
const { tmpdir } = require("os")
const { mkdtemp } = require("fs")

// npm
const del = require("del")

module.exports = {
  beforeEach: (t) =>
    new Promise((resolve, reject) => {
      mkdtemp(`${tmpdir}${sep}`, (err, folder) => {
        if (err) return reject(err)
        t.context.loc = folder
        resolve()
      })
    }),
  afterEach: (t) => {
    if (t.context.loc) return del(`${t.context.loc}${sep}**`, { force: true })
  },
}
