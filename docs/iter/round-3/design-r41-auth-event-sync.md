# R41 设计方案：登录态变更全局广播（authChanged），消除复位后当页 UI 滞后

## 现状取证（2026-08-29，代码实查 + R39 走查记录）
- R39 上线的 403 自动脱困在 `api.js` 内 `clearAuth()` 后仅弹 toast；持有登录态 UI 的页面（discuss `logged`、profile `user`、stats `authUser`）都只在 `onShow` 时重读 storage。
- 后果（R39 testing agent 实测记录在案）：脱困发生在前台页自身请求返回 403 时，该页不会经历 onShow，登录态文案/账号卡保持旧值直到用户离开再回来或刷新——「登录已过期」toast 与页面仍显登录态并存，观感矛盾。
- 影响面 grep 实证：持页级登录态的页面共 3 个（discuss/profile/stats）；其余页面按需即时读 `getToken()`/`anonUid()` 不受影响。

## 差距定级
P2（体验一致性）：功能不受损（storage 已复位、后续请求正常），但状态矛盾会让用户困惑「到底登没登录」。

## 方案（最小改动，不引入状态库）
1. `api.js`：`setAuth()` 与 `clearAuth()` 末尾 `uni.$emit('authChanged')`。
2. 三个持登录态页面在 `onLoad` 里 `uni.$on('authChanged', handler)`、`onUnload` 里 `uni.$off`：
   - discuss.vue：handler 重算 `logged` 并（qid 存在时）reload 评论；
   - profile.vue：handler 重读 `getAuthUser()`；
   - stats.vue：handler 重读 `getAuthUser()`。
3. 不改后端；不引入 Pinia/Vuex（当前仓库无状态库，事件总线即够）。

## 验收
- 本地 `npm run build:h5` 成功。
- 生产：制造账号 uid 残留 403 态（同 R39 方法），前台页触发 403 自动复位后**当页**立即变为游客 UI（discuss placeholder「登录后参与讨论」、profile 账号卡变未登录态），不再需要刷新；正常登录后 profile/stats 即时显示账号（原 onShow 路径回归不受影响）；1440/375 无回归、console 0 error；测试 storage 清理、保护 uid 零 mutation。
