'use strict'
const esbuild = require('esbuild')
const { builtinModules } = require('module')
const pkg = require('./package.json')

const ignoreList = ['sys']

const deps = Object.keys(pkg.dependencies || {})

const internals = (builtinModules || Object.keys(process.binding('natives')))
  .filter(
    (x) =>
      !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !ignoreList.includes(x)
  )
  .sort()

const opts = {
  external: [...internals, ...deps],
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: ['node12'],
}

esbuild.buildSync({
  ...opts,

  ...{ platform: 'node', outfile: pkg.main },
})

esbuild.buildSync({
  ...opts,

  ...{
    format: 'esm',
    outfile: pkg.module,
  },
})
