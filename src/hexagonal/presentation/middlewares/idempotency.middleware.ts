import HttpStatusCodes from '@app/common/httpStatusCodes'
import {
  type IdempotencyResponse,
  IdempotencyService,
} from '@app/common/idempotency/idempotency.service'
import type { NextFunction, Request, Response } from 'express'

export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (req.method !== 'POST') {
    next()
    return
  }

  const rawKey = req.headers['idempotency-key']
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    next()
    return
  }

  const idempotencyKey = rawKey.trim()
  const idempotencyService = IdempotencyService.getInstance()
  const requestHash = idempotencyService.hashRequestBody(req.body)

  // 1. Check if there is an in-flight parallel request with the same key
  const inFlight = idempotencyService.getInFlight(idempotencyKey)
  if (inFlight) {
    if (inFlight.requestHash !== requestHash) {
      res.status(HttpStatusCodes.CONFLICT).json({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency-Key was already used with a different request payload',
        },
      })
      return
    }

    try {
      const cachedResponse = await inFlight.promise
      res.status(cachedResponse.statusCode).json(cachedResponse.body)
      return
    } catch (error) {
      next(error)
      return
    }
  }

  // 2. Check if a completed request exists for this key
  const existing = await idempotencyService.get(idempotencyKey)
  if (existing) {
    if (existing.requestHash !== requestHash) {
      res.status(HttpStatusCodes.CONFLICT).json({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency-Key was already used with a different request payload',
        },
      })
      return
    }

    res.status(existing.response.statusCode).json(existing.response.body)
    return
  }

  // 3. First time seeing this key: setup in-flight tracking and response interception
  let resolveInFlight!: (val: IdempotencyResponse) => void
  let rejectInFlight!: (err: unknown) => void
  const inFlightPromise = new Promise<IdempotencyResponse>((resolve, reject) => {
    resolveInFlight = resolve
    rejectInFlight = reject
  })

  idempotencyService.setInFlight(idempotencyKey, requestHash, inFlightPromise)

  let captured = false

  const finalize = (statusCode: number, body: unknown) => {
    if (captured) return
    captured = true

    const responsePayload: IdempotencyResponse = {
      statusCode,
      body,
    }

    idempotencyService
      .save(idempotencyKey, requestHash, req.originalUrl || req.url, req.method, responsePayload)
      .finally(() => {
        idempotencyService.clearInFlight(idempotencyKey)
        resolveInFlight(responsePayload)
      })
  }

  // Intercept json
  const originalJson = res.json.bind(res)
  res.json = (body: unknown): Response => {
    finalize(res.statusCode, body)
    return originalJson(body)
  }

  // Intercept send
  const originalSend = res.send.bind(res)
  res.send = (body: unknown): Response => {
    let parsedBody: unknown = body
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body)
      } catch {
        // keep string
      }
    }
    finalize(res.statusCode, parsedBody)
    return originalSend(body)
  }

  // Clean up if response fails or closes before send/json
  res.on('close', () => {
    if (!captured && res.statusCode >= 400) {
      idempotencyService.clearInFlight(idempotencyKey)
      rejectInFlight(new Error('Request closed without response'))
    }
  })

  res.on('error', err => {
    idempotencyService.clearInFlight(idempotencyKey)
    rejectInFlight(err)
  })

  next()
}
