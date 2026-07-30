# 测试计划 v7（访问码保护，H5 400px 视口）

Evidence: frontend-uni/src/api.js L8-23（uni.showModal title"请输入访问码" editable，确认后存 storage key accessCode）、L25-35（withAuthRetry：401 后弹框、输入后自动重试一次）、L43（所有请求带 X-Access-Code 头）；backend/app/main.py L12-16 check_access；curl 验证无码/错码均返回 401。服务已以 ACCESS_CODE=kg2026 运行。

前置：清除 localStorage 中 accessCode，窗口 400px 宽。

## T1 首次无码 → 弹输入框
提交一道短文字题。断言 A：不直接报错，而是弹出可编辑 modal，标题"请输入访问码"，placeholder"联系管理员获取"。

## T2 输错码 → 报错
在 modal 输入 wrong123 → 确认。断言 B：重试仍 401，页面出现错误提示（讲解失败 toast/信息，无讲解卡片出现）。

## T3 清 storage → 输入正确码 kg2026 → 成功
清 accessCode 后重新提交题目 → modal 再次弹出 → 输入 kg2026 确认。断言 C：自动重试成功，讲解卡片正常渲染（含答案）。

## T4 后续请求不再询问
再次提交同题（或点举一反三）。断言 D：不再弹访问码输入框，直接进入加载并返回结果。
