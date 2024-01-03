import { defineConfig } from "astro/config"
import rehypePrettyCode from "rehype-pretty-code"
import { addColorPreview } from "./plugins/fp-add-color-preview"

const prettyCodeOptions = {
  theme: "material-theme-lighter",
  onVisitLine(element) {
    console.time("addColorPreview")
    addColorPreview(element)
    console.timeEnd("addColorPreview")
  }
}

export default defineConfig(
  /** @type {import('astro').AstroUserConfig} */ {
    markdown: {
      // Astroビルドインのシンタックスハイライト機能を無効化
      syntaxHighlight: false,
      // 代わりにRehype Pretty Codeを使う
      rehypePlugins: [[rehypePrettyCode, prettyCodeOptions]]
    }
  }
)
