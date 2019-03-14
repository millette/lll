"use strict"

// core
const { sep } = require("path")
const { tmpdir } = require("os")
const { mkdtemp } = require("fs")

module.exports = () =>
  new Promise((resolve, reject) => {
    mkdtemp(`${tmpdir}${sep}`, (err, folder) => {
      if (err) return reject(err)
      resolve(folder)
    })
  })
