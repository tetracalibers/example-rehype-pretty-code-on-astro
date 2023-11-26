import {
  type Option,
  fromNullable,
  map,
  chain,
  fromPredicate,
  isNone,
  match,
  orElse,
  of,
  flatMap,
  isSome,
  ap,
  some,
  Applicative
} from "fp-ts/lib/Option"
import { lookup, of as ofA, filter, sequence } from "fp-ts/lib/Array"
import { flow, pipe } from "fp-ts/lib/function"
import type { Element, ElementContent, Text } from "hast"
import { left, match as matchE, right, type Either } from "fp-ts/lib/Either"
import { validateHTMLColorHex, validateHTMLColorName, validateHTMLColorRgb } from "validate-color"
import { isString } from "fp-ts/lib/string"

type Properties = Element["properties"]

const getChildren = (node: Element) => {
  return pipe(
    node,
    fromNullable,
    map((node) => node.children)
  )
}

const getFirstChild = (node: Element) => {
  return pipe(node, getChildren, chain(lookup(0)))
}

const isTextNode = (node: ElementContent): node is Text => {
  return node.type === "text"
}

const isElementNode = (node: ElementContent): node is Element => {
  return node.type === "element"
}

const getInnerTextNode = (node: Element) => {
  return pipe(node, getFirstChild, chain(fromPredicate(isTextNode)))
}

const getText = (node: Element) => {
  return pipe(
    node,
    getFirstChild,
    chain(fromPredicate(isTextNode)),
    map((node) => node.value)
  )
}

const getTokenValue = ($token: Element) => {
  return pipe(
    $token,
    fromPredicate((node) => node.tagName === "span"),
    chain(getText)
  )
}

const lookAhead = (index: number, $parent: ElementContent[]) => {
  return pipe($parent, lookup(index + 1), chain(fromPredicate(isElementNode)), chain(getText))
}

const mergeToken = (nextToken: string) => (token: string) => {
  return token.concat(nextToken)
}

const inverseBoolean = <A>(fn: (a: A) => boolean) => {
  return (a: A) => !fn(a)
}

const visitMergeNextToken =
  (
    index: number,
    $parent: ElementContent[],
    endCondition: (token: string) => boolean,
    allowToken: (token: string) => boolean
  ) =>
  (token: string): Option<string> => {
    const judgeContinue =
      (predicate: (token: string) => boolean) =>
      (token: string): Either<string, string> => {
        return pipe(
          token,
          fromPredicate(predicate),
          // 続けるならright, 終了ならleft
          match(
            () => left(token), // onNone
            () => right(token) // onSome
          )
        )
      }

    const next = (nextToken: string) => (token: string) => {
      return pipe(nextToken, mergeToken(token), visitMergeNextToken(index + 1, $parent, endCondition, allowToken))
    }

    const end = (nextToken: string) => (token: string) => {
      return pipe(nextToken, mergeToken(token), some)
    }

    return pipe(
      lookAhead(index, $parent),
      map(judgeContinue(inverseBoolean(endCondition))),
      chain(flow(matchE(end(token), flow(judgeContinue(allowToken), matchE(end(token), next(token))))))
    )
  }

const isHexAlphaNumLength = (withoutHexStr: string) => {
  return [3, 4, 6, 8].includes(withoutHexStr.length)
}

const isEmpty = (str: string) => {
  return str.trim() === ""
}

const isNumber = (str: string) => {
  return !isNaN(Number(str))
}

const isComma = (str: string) => {
  return str.trim() === ","
}

const isOpenParen = (str: string) => {
  return str === "("
}

const isCloseParen = (str: string) => {
  return str === ")" || str === ");"
}

// 常にtrueを返す関数
const neverEnd = () => false

// booleanを返す関数を合成する
const pipeValidation = (...fns: ((str: string) => boolean)[]) => {
  return (str: string) => {
    // fn(str)が1つでもtrueであれば良い
    return fns.some((fn) => fn(str))
  }
}

// #で始まるかどうか
const isStartWithHash = (str: string) => {
  return str.startsWith("#")
}

const isIncludeHash = (str: string) => {
  return str.includes("#")
}

// rgbで始まるかどうか
const isStartWithRgb = (str: string) => {
  return str.startsWith("rgb")
}

const isIncludeRgb = (str: string) => {
  return str.includes("rgb")
}

const wrapObject = (color: string, index = 0) => {
  return { color, index }
}

const removeSemicolon = (str: string) => {
  return str.endsWith(";") ? str.slice(0, -1) : str
}

const checkMaybeHex = (token: string, i: number, $tokens: ElementContent[]) => {
  return pipe(
    token,
    fromPredicate(isStartWithHash),
    chain(fromPredicate(validateHTMLColorHex)),
    orElse(() =>
      pipe(
        token,
        visitMergeNextToken(i, $tokens, isHexAlphaNumLength, neverEnd),
        map(removeSemicolon),
        chain(fromPredicate(validateHTMLColorHex))
      )
    )
  )
}

const checkMaybeRgb = (token: string, i: number, $tokens: ElementContent[]) => {
  return pipe(
    token,
    fromPredicate(isStartWithRgb),
    chain(fromPredicate(validateHTMLColorRgb)),
    orElse(() =>
      pipe(
        token,
        visitMergeNextToken(i, $tokens, isCloseParen, pipeValidation(isOpenParen, isEmpty, isNumber, isComma)),
        map(removeSemicolon),
        chain(fromPredicate(validateHTMLColorRgb))
      )
    )
  )
}

const matchHexFormat = (str: string) => {
  return fromNullable(str.match(/#[0-9a-fA-F]{3,8}/))
}

// rgbまたはrgbaの文字列を抽出する
// aの値には小数点を含むことも考慮する
const matchRgbFormat = (str: string) => {
  return fromNullable(str.match(/rgba?\((\d{1,3},\s?){2}\d{1,3}(,\s?(\d|1|0\.\d+))?\)/))
}

// tokenからhexを抽出し、HTMLColorHexとしてvalidかどうかを判定する
// hexの判定結果とRegExpMatchArray.indexをまとめたOptionを返す
const checkHasMaybeHex = (token: string) => {
  return pipe(
    token,
    fromPredicate(isIncludeHash),
    chain(matchHexFormat),
    map((match) => ({ color: match[0], index: match.index })),
    chain(({ color, index }) =>
      pipe(
        color,
        removeSemicolon,
        fromPredicate(validateHTMLColorHex),
        map((color) => ({ color, index }))
      )
    )
  )
}

const checkHasMaybeRgb = (token: string) => {
  return pipe(
    token,
    fromPredicate(isIncludeRgb),
    chain(matchRgbFormat),
    map((match) => ({ color: match[0], index: match.index })),
    chain(({ color, index }) =>
      pipe(
        color,
        removeSemicolon,
        fromPredicate(validateHTMLColorRgb),
        map((color) => ({ color, index }))
      )
    )
  )
}

const checkMaybeColorName = (token: string) => {
  return pipe(token, fromPredicate(validateHTMLColorName))
}

const createSpanElement = (properties: Properties) => {
  return (children: ElementContent[]): Element => {
    return {
      type: "element",
      tagName: "span",
      properties,
      children
    }
  }
}

const createTextNode = (value: string): Text => {
  return { type: "text", value }
}

const createColorPreviewElement = (color: string) => {
  const properties = {
    "data-color-preview": color,
    style: `background-color: ${color};`
  }
  return pipe("", createTextNode, ofA, createSpanElement(properties))
}

const $insert = (els: ElementContent[]) => (index: number) => (newEl: Element) => {
  els.splice(index, 0, newEl)
}

const $replace = (els: ElementContent[]) => (index: number) => (newEls: Element[]) => {
  els.splice(index, 1, ...newEls)
}

const $prepend = (newEl: Element) => (els: ElementContent[]) => {
  els.unshift(newEl)
}

const replaceTextNodeValue = (value: string) => (el: Text) => {
  el.value = value
}

const getBeforeSpace = (token: string) => {
  return token.replace(token.trim(), "")
}

// 要素を色コードとそうでない部分に分割する
const splitTokenByColor = (color: string, colorStart: number, token: string) => {
  const colorEnd = color.length + colorStart

  const before = token.slice(0, colorStart)
  const after = token.slice(colorEnd)

  return { before, after }
}

const isNotEmptyString = (str: string) => {
  return str.length > 0
}

const createElementHasText = (properties: Properties) => (text: string) =>
  pipe(text, fromPredicate(isNotEmptyString), chain(flow(createTextNode, ofA, createSpanElement(properties), of)))

// 色コードとそうでない部分を分割し、間に色プレビュー用のspanを追加する
const insertColorPreviewElementWithSplit = (
  color: string,
  colorStart: number,
  token: string,
  $token: Element,
  index: number,
  $parent: ElementContent[]
) => {
  const { before, after } = splitTokenByColor(color, colorStart, token)

  const elements = [
    createElementHasText($token.properties)(before),
    some(createSpanElement($token.properties)([createColorPreviewElement(color), createTextNode(color)])),
    createElementHasText($token.properties)(after)
  ]

  return pipe(elements, filter(isSome), sequence(Applicative), map($replace($parent)(index)))
}

const convertSpaceToElement = (token: string, $token: Element, index: number, $parent: ElementContent[]) => {
  return pipe(
    token,
    fromPredicate((token) => token.startsWith(" ")),
    flatMap(() => getInnerTextNode($token)),
    map(replaceTextNodeValue(token.trim())),
    map(() => getBeforeSpace(token)),
    flatMap(createElementHasText({})),
    map($insert($parent)(index))
  )
}

const prependColorPreviewElement = (color: string, $token: Element) => {
  return pipe(some(color), map(createColorPreviewElement), map($prepend), ap(of($token.children)))
}

export const addColorPreview = ($line: Element) => {
  const $tokens = $line.children

  $tokens.forEach(($token, i) => {
    if (!isElementNode($token)) return

    const token = getTokenValue($token)
    if (isNone(token)) return

    const trimedToken = token.value.trim()

    const result = pipe(
      checkMaybeHex(trimedToken, i, $tokens),
      orElse(() => checkMaybeRgb(trimedToken, i, $tokens)),
      orElse(() => checkHasMaybeHex(trimedToken)),
      orElse(() => checkHasMaybeRgb(trimedToken)),
      orElse(() => checkMaybeColorName(trimedToken)),
      map((v) => (isString(v) ? wrapObject(v) : v))
    )

    if (isNone(result)) return

    const { color, index } = result.value

    if (index === 0) {
      convertSpaceToElement(token.value, $token, i, $tokens)
      prependColorPreviewElement(color, $token)
    } else {
      insertColorPreviewElementWithSplit(color, index, trimedToken, $token, i, $tokens)
    }
  })
}
