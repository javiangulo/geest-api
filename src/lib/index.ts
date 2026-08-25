import type { NextFunction, Request, Response } from 'express'

export type AppRequest<
  B = unknown,
  P = Record<string, string>,
  Q = Record<string, string>,
> = Request<P, unknown, B, Q>

export type AppResponse = Response

export type AppNextFunction = NextFunction

export interface IApiResponse<T = unknown> {
  status: 'success' | 'error'
  message?: string
  data?: T
}
