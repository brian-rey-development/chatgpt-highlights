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

const USER_MESSAGES: Record<ErrorCode, string> = {
  invalid_message: "That request wasn't valid. Reload the page and try again",
  invalid_backup: "That file isn't a valid backup",
  not_found: 'That highlight or chat no longer exists',
  unreachable: "Couldn't reach the extension. Reload the page and try again",
  unexpected: 'Something went wrong. Try again',
}

export const userMessageOf = ({ code }: AppError): string => USER_MESSAGES[code]
