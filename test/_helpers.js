"use strict"

// core
import { sep } from "path"
import { tmpdir } from "os"
import { mkdtemp } from "fs"

// npm
import del from "del"

export default {
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

/*
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
*/
