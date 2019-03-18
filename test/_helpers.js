"use strict"

// core
import { sep } from "path"
import { tmpdir } from "os"
import { mkdtemp } from "fs"

// npm
import del from "del"

export const beforeEach = (t) =>
  new Promise((resolve, reject) => {
    mkdtemp(`${tmpdir}${sep}`, (err, folder) => {
      if (err) return reject(err)
      t.context.loc = folder
      resolve()
    })
  })

export const afterEach = (t) => {
  if (t.context.loc) return del(`${t.context.loc}${sep}**`, { force: true })
}
