import { debuglog } from 'node:util'

export const debugHttp = debuglog('geest:http')
export const debugDb = debuglog('geest:db')
export const debugIdempotency = debuglog('geest:idempotency')
export const debugNotification = debuglog('geest:notification')

export const logger = {
  info: (...args: unknown[]) => console.info('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG || process.env.NODE_DEBUG?.includes('geest')) {
      console.debug('[DEBUG]', ...args)
    }
  },
}
