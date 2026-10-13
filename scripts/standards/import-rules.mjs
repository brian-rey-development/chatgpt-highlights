import path from 'node:path'
import ts from 'typescript'
import { lineOf } from './ast.mjs'
import {
  BROWSER_API,
  BROWSER_API_LAYERS,
  CONTENT_BANNED,
  CONTENT_ENTRY,
  DOMAINS,
  E2E_TEST_SUPPORT,
  EDGES,
  FOREIGN_ALIAS,
  isTestCode,
  layerOf,
  RELATIVE_SPEC,
} from './config.mjs'

const isDynamicImport = (node) =>
  ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword

const specifierNode = (node) => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier
  if (isDynamicImport(node)) return node.arguments[0]
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal
  return
}

const isStaticText = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)

const importSpecifiers = ({ sourceFile, nodes }) =>
  nodes.flatMap((node) => {
    const specifier = specifierNode(node)
    if (!specifier) return []
    return [
      { line: lineOf(sourceFile, node), spec: isStaticText(specifier) ? specifier.text : null },
    ]
  })

const ALL_DOMAIN_LAYERS = new Set(['entrypoints', 'testing', 'e2e'])

const allowedTargets = (file) => {
  const layer = layerOf(file)
  return ALL_DOMAIN_LAYERS.has(layer) ? DOMAINS : (EDGES[layer] ?? [])
}

const contentBan = (file, target) =>
  file.startsWith(CONTENT_ENTRY) && CONTENT_BANNED.has(target)
    ? [`content script may not import ${target}`]
    : []

const ENTRY_BOUNDARY_SEGMENTS = 3
const DOMAIN_BOUNDARY_SEGMENTS = 2

const boundaryOf = (file) => {
  if (layerOf(file) === 'e2e') return 'e2e'
  const depth = layerOf(file) === 'entrypoints' ? ENTRY_BOUNDARY_SEGMENTS : DOMAIN_BOUNDARY_SEGMENTS
  return file.split('/').slice(0, depth).join('/')
}

const relativeIssues = (file, spec) => {
  const resolved = path.posix.join(path.posix.dirname(file), spec)
  const boundary = boundaryOf(file)
  const staysInside = resolved === boundary || resolved.startsWith(`${boundary}/`)
  return staysInside ? [] : ['relative import leaves its domain; use @/<domain>']
}

const TESTING_SPEC = /^@\/testing(\/|$)/

const testingIssues = (file, spec) => {
  if (layerOf(file) !== 'e2e') return isTestCode(file) ? [] : ['only tests may import @/testing']
  return E2E_TEST_SUPPORT.has(spec) ? [] : ['e2e may import only the vitest-free test modules']
}

const isTestingImport = (file, spec) =>
  spec === '@/testing' || (layerOf(file) === 'e2e' && TESTING_SPEC.test(spec))

const aliasIssues = (file, spec) => {
  if (isTestingImport(file, spec)) return testingIssues(file, spec)
  const [target, ...rest] = spec.slice('@/'.length).split('/')
  if (rest.length > 0) return [`deep import ${spec}; import the domain index`]
  if (target === layerOf(file))
    return [`imports its own domain through ${spec}; use a relative path`]
  const edge = allowedTargets(file).includes(target)
    ? []
    : [`${layerOf(file)} may not import ${target}`]
  return [...edge, ...contentBan(file, target)]
}

const packageIssues = (file, spec) => {
  const browserApi = BROWSER_API.test(spec) && !BROWSER_API_LAYERS.has(layerOf(file))
  return [
    ...(browserApi && !isTestCode(file) ? [`${layerOf(file)} may not import ${spec}`] : []),
    ...contentBan(file, spec.split('/')[0]),
  ]
}

const specIssues = (file, spec) => {
  if (spec === null) return ['import specifier must be a string literal']
  if (RELATIVE_SPEC.test(spec)) return relativeIssues(file, spec)
  if (FOREIGN_ALIAS.test(spec))
    return [`${spec}: use @/<domain>, or a relative path inside the domain`]
  if (spec.startsWith('@/')) return aliasIssues(file, spec)
  return packageIssues(file, spec)
}

export const importIssues = (source) =>
  importSpecifiers(source).flatMap(({ line, spec }) =>
    specIssues(source.file, spec).map((message) => ({ line, message })),
  )
