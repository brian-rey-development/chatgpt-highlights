import ts from 'typescript'

const collect = (node, nodes) => {
  nodes.push(node)
  // forEachChild stops on a truthy return
  ts.forEachChild(node, (child) => {
    collect(child, nodes)
  })
  return nodes
}

export const parseSource = (file, text) => {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  return { sourceFile, nodes: collect(sourceFile, []) }
}

export const lineOf = (sourceFile, node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
