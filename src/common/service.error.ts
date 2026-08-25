export class ServiceError extends Error {
  public readonly code: string

  public readonly description: string

  constructor(message: string, code = '', description = '') {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)

    // assign the error class name in your custom error (as a shortcut)
    this.name = this.constructor.name
    this.code = code
    this.description = description

    // capturing the stack trace keeps the reference to your error class
    Error.captureStackTrace(this, this.constructor)
  }
}
