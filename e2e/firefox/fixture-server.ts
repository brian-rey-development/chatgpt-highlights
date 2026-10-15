import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const LOCALHOST = '127.0.0.1'
const PAGE =
  '<!doctype html><html><head><title>Fixture</title></head><body><main></main></body></html>'

export interface FixtureServer {
  url: string
  stop: () => Promise<void>
}

const selfSignedCertificate = (directory: string, host: string): { key: Buffer; cert: Buffer } => {
  const key = join(directory, 'key.pem')
  const cert = join(directory, 'cert.pem')
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${host}`].concat([
      '-addext',
      `subjectAltName=DNS:${host}`,
      '-keyout',
      key,
      '-out',
      cert,
    ]),
    { stdio: 'ignore' },
  )
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

export const startFixtureServer = async (pageUrl: string): Promise<FixtureServer> => {
  const real = new URL(pageUrl)
  const directory = mkdtempSync(join(tmpdir(), 'hl-cert-'))
  const server = createServer(
    selfSignedCertificate(directory, real.hostname),
    (_request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end(PAGE)
    },
  )
  await new Promise<void>((resolve) => server.listen(0, LOCALHOST, resolve))
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('fixture server has no port')
  return {
    url: `${real.protocol}//${real.hostname}:${address.port}${real.pathname}`,
    stop: async () => {
      await new Promise((resolve) => server.close(resolve))
      rmSync(directory, { recursive: true, force: true })
    },
  }
}
