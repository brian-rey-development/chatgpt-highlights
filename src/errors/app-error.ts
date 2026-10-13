import { fieldOf } from '@/model'

export type ErrorCode =
  | 'invalid_message'
  | 'invalid_backup'
  | 'not_found'
  | 'unreachable'
  | 'unexpected'

export interface AppError {
  code: ErrorCode
  message: string
}

export class AppFailure extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppFailure'
    this.code = code
  }
}

export const messageOf = (error: unknown): string => {
  const message = fieldOf(error, 'message')
  return typeof message === 'string' ? message : String(error)
}

export const toAppError = (error: unknown): AppError =>
  error instanceof AppFailure
    ? { code: error.code, message: error.message }
    : { code: 'unexpected', message: messageOf(error) }
