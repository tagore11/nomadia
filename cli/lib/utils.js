import { ApiError } from './api.js'

// Every command's handler is wrapped in this so failures print one JSON
// object to stdout (agent-parseable) and exit non-zero, instead of a stack
// trace on stderr.
export function run(fn) {
  return async (argv) => {
    try {
      const result = await fn(argv)
      if (result !== undefined) printJson(result)
    } catch (err) {
      if (err instanceof ApiError) {
        printJson({ error: err.code, status: err.status, ...err.details })
      } else {
        printJson({ error: 'CLI_ERROR', message: err.message })
      }
      process.exitCode = 1
    }
  }
}

export function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
}
