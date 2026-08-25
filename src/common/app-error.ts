import HttpStatusCodes from './httpStatusCodes'

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(code: string, message: string, statusCode: number = HttpStatusCodes.BAD_REQUEST) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, HttpStatusCodes.BAD_REQUEST)
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, HttpStatusCodes.NOT_FOUND)
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, HttpStatusCodes.CONFLICT)
  }
}
