"use strict"

// core
const { sep } = require("path")
const { tmpdir } = require("os")
const { mkdtemp } = require("fs")

module.exports = (t) =>
  new Promise((resolve, reject) => {
    mkdtemp(`${tmpdir}${sep}`, (err, folder) => {
      if (err) return reject(err)
      t.context.loc = folder
      resolve()
    })
  })
