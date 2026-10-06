import process from 'node:process'
import {
  testInstalledRuntime,
  withInstalledPackage,
} from './package-consumer.js'

// Runtime-only CI entry point: no compiler or development dependencies needed.
withInstalledPackage(process.argv[2], ({ consumerDirectory }) => {
  testInstalledRuntime(consumerDirectory)
})
