import crypto from 'node:crypto'
import { IdempotencyModel } from '@app/hexagonal/infrastructure/adapters/databases/postgres/models'
import { getPostgresDataSource } from '@app/hexagonal/infrastructure/adapters/databases/postgres/postgres.data-source'

export interface IdempotencyResponse {
  statusCode: number
  body: unknown
  headers?: Record<string, string | string[]>
}

export interface InFlightEntry {
  requestHash: string
  promise: Promise<IdempotencyResponse>
}

export interface StoredIdempotencyRecord {
  requestHash: string
  response: IdempotencyResponse
  createdAt: Date
}

export class IdempotencyService {
  private static instance: IdempotencyService
  private inFlightMap = new Map<string, InFlightEntry>()
  private cache = new Map<string, StoredIdempotencyRecord>()

  static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService()
    }
    return IdempotencyService.instance
  }

  /**
   * Deterministically hash any request body into a sha256 hex string.
   */
  hashRequestBody(body: unknown): string {
    if (body === undefined || body === null) {
      return crypto.createHash('sha256').update('').digest('hex')
    }

    if (typeof body === 'string') {
      return crypto.createHash('sha256').update(body).digest('hex')
    }

    if (Buffer.isBuffer(body)) {
      return crypto.createHash('sha256').update(body).digest('hex')
    }

    // Recursively sort keys for objects to ensure consistent hashing
    const canonicalString = JSON.stringify(this.sortObjectKeys(body))
    return crypto.createHash('sha256').update(canonicalString).digest('hex')
  }

  private sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item))
    }

    const sortedObj: Record<string, unknown> = {}
    const keys = Object.keys(obj as Record<string, unknown>).sort()
    for (const key of keys) {
      sortedObj[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sortedObj
  }

  getInFlight(key: string): InFlightEntry | undefined {
    return this.inFlightMap.get(key)
  }

  setInFlight(key: string, requestHash: string, promise: Promise<IdempotencyResponse>): void {
    this.inFlightMap.set(key, { requestHash, promise })
  }

  clearInFlight(key: string): void {
    this.inFlightMap.delete(key)
  }

  async get(key: string): Promise<StoredIdempotencyRecord | null> {
    // 1. Check in-memory cache first
    const cached = this.cache.get(key)
    if (cached) {
      return cached
    }

    // 2. Check Postgres database if initialized
    try {
      const ds = getPostgresDataSource()
      if (ds.isInitialized) {
        const repo = ds.getRepository(IdempotencyModel)
        const record = await repo.findOneBy({ key })
        if (record) {
          let parsedBody: unknown = record.responseBody
          try {
            parsedBody = JSON.parse(record.responseBody)
          } catch {
            // Keep as string if not JSON
          }

          const result: StoredIdempotencyRecord = {
            requestHash: record.requestHash,
            response: {
              statusCode: record.statusCode,
              body: parsedBody,
              headers: record.headers || undefined,
            },
            createdAt: record.createdAt,
          }
          this.cache.set(key, result)
          return result
        }
      }
    } catch {
      // Ignore database errors and fallback to cache
    }

    return null
  }

  async save(
    key: string,
    requestHash: string,
    requestPath: string,
    requestMethod: string,
    response: IdempotencyResponse,
  ): Promise<void> {
    const record: StoredIdempotencyRecord = {
      requestHash,
      response,
      createdAt: new Date(),
    }
    this.cache.set(key, record)

    try {
      const ds = getPostgresDataSource()
      if (ds.isInitialized) {
        const repo = ds.getRepository(IdempotencyModel)
        const entity = repo.create({
          key,
          requestHash,
          requestPath,
          requestMethod,
          statusCode: response.statusCode,
          responseBody:
            typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
          headers: response.headers || null,
        })
        await repo.save(entity)
      }
    } catch {
      // Ignore DB write errors on in-memory mode
    }
  }

  clearAll(): void {
    this.inFlightMap.clear()
    this.cache.clear()
  }
}
