/* miniprogram-ci 体验版上传：WX_KEY_PATH=<上传密钥文件> node scripts/upload.js <version> <desc>
   注意：miniprogram-ci 的 upload 会扫描 projectPath 下所有 js，
   项目内不能存在 node_modules（先 mv 走或在干净 checkout 里跑），
   miniprogram-ci 本身从别处 require（如全局安装或独立目录）。 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execSync } = require('child_process')
const ci = require('miniprogram-ci')

async function main() {
  const version = process.argv[2] || '0.1.0'
  const desc = process.argv[3] || '体验版上传'
  const projectPath = path.resolve(__dirname, '..')
  if (fs.existsSync(path.join(projectPath, 'node_modules'))) {
    throw new Error('projectPath 下存在 node_modules，请先移走再上传（ci.upload 会误扫描）')
  }
  // 在临时目录只装 tdesign-miniprogram，构建 miniprogram_npm（避免打包 devDependencies）
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'wxpack-'))
  const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'))
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify({ name: 'pack', version: '1.0.0', dependencies: { 'tdesign-miniprogram': pkg.dependencies['tdesign-miniprogram'] } })
  )
  execSync('npm install --no-audit --no-fund', { cwd: stage, stdio: 'inherit' })
  const packResult = await ci.packNpmManually({
    packageJsonPath: path.join(stage, 'package.json'),
    miniprogramNpmDistDir: path.join(projectPath, 'miniprogram'),
  })
  console.log('packNpm:', JSON.stringify({ mini: packResult.miniProgramPackNum, warn: (packResult.warnList || []).length }))

  const project = new ci.Project({
    appid: 'wx01f2f29cfe51baba',
    type: 'miniProgram',
    projectPath,
    privateKeyPath: process.env.WX_KEY_PATH,
    ignores: ['node_modules/**/*'],
  })
  const result = await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, es7: true, minify: true },
  })
  console.log('upload done:', JSON.stringify(result))
}

main().catch((e) => {
  console.error('upload failed:', e.message || e)
  process.exit(1)
})
