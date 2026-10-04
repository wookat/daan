/* miniprogram-ci 体验版/上传脚本（提交入库版，与 miniapp-native/scripts/upload.js 同源）。
 *
 * 前置：
 *   1. 微信公众平台 → 管理 → 版本管理 → 开发设置 → 小程序代码上传密钥，下载 private.wx*.key
 *   2. 任意目录 npm i miniprogram-ci（不要装进 miniapp-native/——ci.upload 会扫描
 *      projectPath 下所有 js，node_modules 会破坏上传）
 *
 * 用法：
 *   WX_KEY_PATH=C:\path\private.wx.key WX_CI_DIR=C:\path\to\ci-install \
 *     node tools/mp-ci/upload.cjs <version> [desc]
 *   - WX_KEY_PATH：上传密钥文件（必填）
 *   - WX_CI_DIR：装了 miniprogram-ci 的目录（默认 ../mp-ci-deps，即仓库旁的独立安装目录）
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const CI_DIR = process.env.WX_CI_DIR || path.resolve(__dirname, '../../mp-ci-deps');
let ci;
try {
  ci = require(path.join(CI_DIR, 'node_modules', 'miniprogram-ci'));
} catch (e) {
  console.error(`miniprogram-ci 未找到：在 ${CI_DIR} 下 npm init -y && npm i miniprogram-ci，或用 WX_CI_DIR 指定`);
  process.exit(1);
}

async function main() {
  const version = process.argv[2] || '0.1.0';
  const desc = process.argv[3] || '体验版上传';
  const projectPath = path.resolve(__dirname, '../../miniapp-native');
  if (!process.env.WX_KEY_PATH || !fs.existsSync(process.env.WX_KEY_PATH)) {
    throw new Error('WX_KEY_PATH 未设置或文件不存在（微信公众平台→小程序代码上传密钥）');
  }
  if (fs.existsSync(path.join(projectPath, 'node_modules'))) {
    throw new Error('miniapp-native/node_modules 存在，请先移走再上传（ci.upload 会误扫描）');
  }
  // 在临时目录只装 tdesign-miniprogram，构建 miniprogram_npm（避免打包 devDependencies）
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'wxpack-'));
  const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify({
      name: 'pack',
      version: '1.0.0',
      dependencies: { 'tdesign-miniprogram': pkg.dependencies['tdesign-miniprogram'] },
    }),
  );
  execSync('npm install --no-audit --no-fund', { cwd: stage, stdio: 'inherit' });
  const packResult = await ci.packNpmManually({
    packageJsonPath: path.join(stage, 'package.json'),
    miniprogramNpmDistDir: path.join(projectPath, 'miniprogram'),
  });
  console.log('packNpm:', JSON.stringify({ mini: packResult.miniProgramPackNum, warn: (packResult.warnList || []).length }));

  const project = new ci.Project({
    appid: 'wx01f2f29cfe51baba',
    type: 'miniProgram',
    projectPath,
    privateKeyPath: process.env.WX_KEY_PATH,
    ignores: ['node_modules/**/*'],
  });
  const result = await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, es7: true, minify: true },
  });
  console.log('upload done:', JSON.stringify(result));
}

main().catch((e) => {
  console.error('upload failed:', e.message || e);
  process.exit(1);
});
