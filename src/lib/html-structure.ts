import { JSDOM } from "jsdom"

interface TagTree {
  tag: string
  attributes: { [key: string]: string }
  innerText: string
  children?: TagTree[] | string
}

const buildHTMLTagTree = (dom: DocumentFragment | Element) => {
  const tree: TagTree[] = []
  const children = Array.from(dom.children)
  for (const child of children) {
    const tag = child.tagName.toLowerCase()
    const attributes = Array.from(child.attributes).reduce((acc, { name, value }) => {
      acc[name] = value
      return acc
    }, {})
    const children = buildHTMLTagTree(child)
    const innerText = child.textContent ?? ""
    tree.push({ tag, attributes, innerText, children })
  }
  return tree
}

const formatHTMLTagTree = (tree: TagTree[], maxChildrenMap: number[], indent = 0) => {
  const indentString = "  ".repeat(indent)
  return tree
    .map(({ tag, attributes, children: _children, innerText }) => {
      const attributesString = Object.entries(attributes)
        .map(([key, value]) => {
          return value.length > 0 ? `${key}="${value}"` : key
        })
        .join(" ")

      const children = Array.isArray(_children) ? formatHTMLTagTree(_children, maxChildrenMap, indent + 1) : _children

      // 子が4つ以上ある場合は、4つのみ表示し、省略コメントを追加
      const maxChildren = maxChildrenMap[indent]
      if (Array.isArray(_children) && _children.length > maxChildren) {
        const children = formatHTMLTagTree(_children.slice(0, maxChildren), maxChildrenMap, indent + 1)
        const comment = `<!-- and ${_children.length - maxChildren} more children -->`
        return `${indentString}<${tag} ${attributesString}>\n${children}\n${indentString}  ${comment}\n${indentString}</${tag}>`
      }

      if (children) {
        return `${indentString}<${tag} ${attributesString}>\n${children}\n${indentString}</${tag}>`
      } else {
        return `${indentString}<${tag} ${attributesString}>${innerText}</${tag}>`
      }
    })
    .join("\n")
}

export const consoleHTML = (html: string, maxShowChildrenCountMap?: Record<string, number>) => {
  const maxShowChildrenCounts = maxShowChildrenCountMap ? Object.values(maxShowChildrenCountMap) : []
  const dom = JSDOM.fragment(html)
  const tree = buildHTMLTagTree(dom)
  const formattedHTML = formatHTMLTagTree(tree, maxShowChildrenCounts)
  console.log(formattedHTML)
}
