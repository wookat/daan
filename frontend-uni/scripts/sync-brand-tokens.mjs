// 从 @zalize/brand 包同步品牌 token 到 src/static/brand/zalize-tokens.css。
// 品牌 token 唯一来源是 wookat/zalize-brand 仓 + 版本 tag，禁止手改本地拷贝。
import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const pkgDir = dirname(require.resolve('@zalize/brand'))
copyFileSync(join(pkgDir, 'tokens.css'), join(root, 'src/static/brand/zalize-tokens.css'))
console.log('synced zalize-tokens.css from @zalize/brand')
