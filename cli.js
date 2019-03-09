"use strict"

// self
const run = require("./run.js")

run("baba2", { errorIfExists: false }).catch((e) => {
  console.error(e)
})
