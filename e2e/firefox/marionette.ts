import { connect, type Socket } from 'node:net'

const LOCALHOST = '127.0.0.1'
const FRAME_SEPARATOR = ':'
const COMMAND_TYPE = 0
const CONNECT_RETRY_MS = 250
const CONNECT_TIMEOUT_MS = 30_000

export interface Marionette {
  send: (command: string, params?: object) => Promise<unknown>
  close: () => void
}

interface Frames {
  frames: string[]
  rest: Buffer
}

const readFrames = (pending: Buffer, frames: string[] = []): Frames => {
  const colon = pending.indexOf(FRAME_SEPARATOR)
  if (colon < 0) return { frames, rest: pending }
  const end = colon + 1 + Number(pending.subarray(0, colon).toString())
  if (pending.length < end) return { frames, rest: pending }
  const frame = pending.subarray(colon + 1, end).toString()
  return readFrames(pending.subarray(end), [...frames, frame])
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const tryConnect = (port: number): Promise<Socket | null> =>
  new Promise((resolve) => {
    const socket = connect(port, LOCALHOST)
    socket.once('connect', () => resolve(socket))
    socket.once('error', () => resolve(null))
  })

const connectWhenReady = async (port: number, deadline: number): Promise<Socket> => {
  const socket = await tryConnect(port)
  if (socket) return socket
  if (Date.now() > deadline) throw new Error(`Firefox never opened Marionette on port ${port}`)
  await pause(CONNECT_RETRY_MS)
  return connectWhenReady(port, deadline)
}

const createInbox = (socket: Socket): (() => Promise<unknown>) => {
  const arrived: unknown[] = []
  const waiting: ((message: unknown) => void)[] = []
  let pending: Buffer = Buffer.alloc(0)
  socket.on('data', (chunk: Buffer) => {
    const read = readFrames(Buffer.concat([pending, chunk]))
    pending = read.rest
    for (const frame of read.frames) {
      const message: unknown = JSON.parse(frame)
      const waiter = waiting.shift()
      if (waiter) waiter(message)
      else arrived.push(message)
    }
  })
  return () =>
    new Promise((resolve) => {
      const message = arrived.shift()
      if (message === undefined) waiting.push(resolve)
      else resolve(message)
    })
}

const resultOf = (reply: unknown): unknown => {
  if (!Array.isArray(reply)) throw new Error('Marionette sent a reply that is not a message')
  const [, , error, result] = reply
  if (error) throw new Error(`Marionette error ${JSON.stringify(error)}`)
  return result
}

export const openMarionette = async (port: number): Promise<Marionette> => {
  const socket = await connectWhenReady(port, Date.now() + CONNECT_TIMEOUT_MS)
  const next = createInbox(socket)
  await next()
  let lastId = 0
  const send = async (command: string, params: object = {}): Promise<unknown> => {
    lastId += 1
    const body = JSON.stringify([COMMAND_TYPE, lastId, command, params])
    socket.write(`${Buffer.byteLength(body)}${FRAME_SEPARATOR}${body}`)
    return resultOf(await next())
  }
  return { send, close: () => socket.destroy() }
}
