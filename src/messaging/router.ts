import { err, ok, type Result, toAppError } from '@/errors'
import type { Handlers, Request } from './types'

export type Route = (message: unknown) => Promise<Result<unknown>>

type Parse = (message: unknown) => Result<Request>

const runHandler = async (handlers: Handlers, request: Request): Promise<Result<unknown>> => {
  try {
    // TS cannot match the request to its handler
    const handler = handlers[request.type] as (request: Request) => Promise<unknown>
    return ok(await handler(request))
  } catch (error) {
    return err(toAppError(error))
  }
}

export const createRouter =
  (parse: Parse, handlers: Handlers): Route =>
  async (message) => {
    const parsed = parse(message)
    if (!parsed.ok) return err({ code: 'invalid_message', message: parsed.error.message })
    return runHandler(handlers, parsed.data)
  }
