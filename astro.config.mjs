import { defineConfig } from "astro/config"
import rehypePrettyCode from "rehype-pretty-code"

const prettyCodeOptions = {
  /** これから追加していく */
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