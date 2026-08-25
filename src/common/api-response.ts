import type { PaginationMeta } from './pagination'

export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
  pagination?: PaginationMeta
}

export const successResponse = <T>(
  data: T,
  message = 'Success',
  code = 'SUCCESS',
  pagination?: PaginationMeta,
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    code,
    message,
    data,
  }

  if (pagination !== undefined) {
    response.pagination = pagination
  }

  return response
}
