import ts from 'typescript'
import { lineOf } from './ast.mjs'
import { CLASS_ALLOWED, COMMENT, isTestCode } from './config.mjs'

const isConstAssertion = (node) =>
  ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === 'const'

const isTypeAssertion = (node) =>
  (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !isConstAssertion(node)

const isClass = (node) => ts.isClassDeclaration(node) || ts.isClassExpression(node)

const isTypeImport = (statement) =>
  ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly === true

const isTypeExport = (statement) => ts.isExportDeclaration(statement) && statement.isTypeOnly

const isTypeDeclaration = (statement) =>
  ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)

const isTypeOnlyStatement = (statement) =>
  isTypeDeclaration(statement) || isTypeImport(statement) || isTypeExport(statement)

export const castIssues = ({ lines, sourceFile, nodes }) =>
  nodes.filter(isTypeAssertion).flatMap((node) => {
    const line = lineOf(sourceFile, node)
    const lineAbove = lines[line - 2] ?? ''
    return COMMENT.test(lineAbove)
      ? []
      : [{ line, message: 'type assertion without a WHY comment above' }]
  })

export const classIssues = ({ file, sourceFile, nodes }) => {
  if (isTestCode(file) || CLASS_ALLOWED.has(file)) return []
  return nodes
    .filter(isClass)
    .map((node) => ({ line: lineOf(sourceFile, node), message: 'class declaration' }))
}

export const typesFileIssues = ({ file, sourceFile }) => {
  if (!file.endsWith('/types.ts')) return []
  return sourceFile.statements
    .filter((statement) => !isTypeOnlyStatement(statement))
    .map((statement) => ({
      line: lineOf(sourceFile, statement),
      message: 'types.ts may hold only interfaces, type aliases and type-only imports and exports',
    }))
}
