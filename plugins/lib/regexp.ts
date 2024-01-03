import { pipe } from "fp-ts/lib/function"
import { compile, string } from "expressive-ts/lib/Expression"

export const hexColorRegExp = pipe(compile, string("#"))
