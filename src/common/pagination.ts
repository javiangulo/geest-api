export type SortOrder = 'ASC' | 'DESC'

export interface PaginationQueryParams {
  page?: string | number
  limit?: string | number
  offset?: string | number
  order?: string
  cursor?: string
}

export interface ParsedPagination {
  page: number
  limit: number
  offset: number
  order: SortOrder
  cursor?: string | null
}

export interface PaginationMeta {
  page: number
  limit: number
  offset: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  cursor: string | null
  nextCursor: string | null
  order: SortOrder
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: PaginationMeta
}

interface DecodedCursor {
  page?: number
  offset?: number
  id?: string
  createdAt?: string
}

export const decodeCursor = (cursorStr: string): DecodedCursor | null => {
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf-8')
    const parsed = JSON.parse(raw) as DecodedCursor
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export const encodeCursor = (payload: DecodedCursor): string => {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export const parsePaginationParams = (query: PaginationQueryParams = {}): ParsedPagination => {
  const parsedLimit = Math.min(Math.max(Number(query.limit) || 10, 1), 100)

  let page = 1
  let offset = 0
  let cursorStr: string | null = null

  if (query.cursor && typeof query.cursor === 'string' && query.cursor.trim() !== '') {
    cursorStr = query.cursor.trim()
    const decoded = decodeCursor(cursorStr)
    if (decoded) {
      if (typeof decoded.offset === 'number' && decoded.offset >= 0) {
        offset = decoded.offset
        page = Math.floor(offset / parsedLimit) + 1
      } else if (typeof decoded.page === 'number' && decoded.page >= 1) {
        page = decoded.page
        offset = (page - 1) * parsedLimit
      }
    }
  } else if (query.offset !== undefined && query.offset !== '') {
    offset = Math.max(Number(query.offset) || 0, 0)
    page = Math.floor(offset / parsedLimit) + 1
  } else if (query.page !== undefined && query.page !== '') {
    page = Math.max(Number(query.page) || 1, 1)
    offset = (page - 1) * parsedLimit
  }

  const normalizedOrder: SortOrder =
    String(query.order || '')
      .toUpperCase()
      .trim() === 'ASC'
      ? 'ASC'
      : 'DESC'

  return {
    page,
    limit: parsedLimit,
    offset,
    order: normalizedOrder,
    cursor: cursorStr,
  }
}

export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number,
  offset: number,
  order: SortOrder = 'DESC',
  items?: Array<{ id?: string; createdAt?: Date }>,
  currentCursor?: string | null,
): PaginationMeta => {
  const totalPages = Math.max(Math.ceil(totalItems / limit), 1)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  let nextCursor: string | null = null
  if (hasNextPage && items && items.length > 0) {
    const lastItem = items[items.length - 1]
    const nextOffset = offset + items.length
    nextCursor = encodeCursor({
      page: page + 1,
      offset: nextOffset,
      id: lastItem?.id,
      createdAt: lastItem?.createdAt ? new Date(lastItem.createdAt).toISOString() : undefined,
    })
  }

  return {
    page,
    limit,
    offset,
    totalItems,
    totalPages,
    hasNextPage,
    hasPrevPage,
    cursor: currentCursor ?? null,
    nextCursor,
    order,
  }
}

export const paginateArray = <T extends { id?: string; createdAt?: Date }>(
  items: T[],
  params: ParsedPagination,
): PaginatedResult<T> => {
  const totalItems = items.length
  const sorted = [...items].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return params.order === 'ASC' ? timeA - timeB : timeB - timeA
  })

  const paginatedItems = sorted.slice(params.offset, params.offset + params.limit)
  const pagination = buildPaginationMeta(
    totalItems,
    params.page,
    params.limit,
    params.offset,
    params.order,
    paginatedItems,
    params.cursor,
  )

  return {
    items: paginatedItems,
    pagination,
  }
}
