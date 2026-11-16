# R17 设计：AI 问答页桌面空态操作台（粘贴/上传优先）

## 取证（2026-08-29，生产 1440×900）

- `https://kaogong.zalize.com/#/pages/ask/ask`：空态为移动端「相机取景屏」（.camscreen 深色卡，中央「将题目放入框内拍下」+ 快门按钮），宽 ~760px 居中，右侧大量留白。
- 桌面用户无摄像头拍题习惯：主流程应是 **粘贴题目文字** 或 **粘贴/上传题目截图**（对标夸克桌面端粘贴截图提问）。当前文字入口藏在小字「文字输入」，图片入口是「相册」小图标，均为二级入口。
- inputbar 已在 R15 验证贴合 1280 壳内容区（x=288/right=1345）。

## 差距定级

- P1（功能深度/操作台）：桌面空态首屏主 CTA 与桌面输入方式错位；无 Ctrl+V 粘贴截图、无拖拽上传。

## 方案

仅 `frontend-uni/src/pages/ask/ask.vue`，零后端、复用既有 submitText/openAlbum/imagePath 确认 sheet 流程。

### 结构（空态 !results.length && !loading）

```text
空态
├── .camscreen（<1024px 原样；≥1024px display:none）
├── .deskstart（H5 条件编译；仅 ≥1024px 显示，双栏卡）
│   ├── 左：粘贴题目文字——内联 textarea(v-model qtext) + 答案 chips(uanswer) + 「用花生十三方法讲解」(submitText)
│   └── 右：上传题目截图——dropzone（点击 openAlbum；支持 Ctrl+V 粘贴、拖拽图片 → 走既有图片确认 sheet）
└── .card.reccard 最近讲解（从 camscreen 内移出，两端共用）
```

### 交互

- Ctrl+V 粘贴图片：H5 ≥1024px 在 onShow 挂 window paste 监听（onHide/onUnload 卸载，同 book.vue keydown 模式）；clipboard 含图片文件时 → imageFile/imagePath → 既有确认 sheet；loading 中忽略；文本粘贴不受影响（无 image item 时不拦截）。会话中也可粘贴（等同「再拍一题」）。
- 拖拽：dropzone 上 dragover.prevent/drop.prevent，取 dataTransfer.files[0]（image/*）。
- 移动端（<1024）与小程序/App：零变化（deskstart 与监听均 H5+宽度守卫）。

## 验收

- 1440：空态双栏操作台替代取景屏；粘贴文字→讲解、Ctrl+V 截图→确认 sheet→讲解、拖拽图片均可用；console 0 error。
- 375：camscreen 原样、无 deskstart、无横向滚动。
- 既有流程（相册、历史、追问、举一反三、存错题本）不回归。
