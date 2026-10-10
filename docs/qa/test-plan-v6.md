# 测试计划 v6（uni-app H5 重写全量回归）

Evidence: frontend-uni/src/pages/ask/ask.vue L19 (hist fold row toggles r.folded), L28-29 (save/举一反三 button states), L34-47 (先选答案→picked 后显示解析+详解按钮), L154-174 (答案解析 correct, optCls: correct→'ok' green, picked wrong→'bad' red), L72-79 (onShow reads redoQuestion storage, toast "题目已填入，先自己做一遍再点讲解"); book.vue L7 (重做), L44-48 (setStorage+switchTab, delete showModal); stats.vue. :8000 已确认为 uni-app H5 构建。

## T1 讲解主链路（桌面）
粘贴基期量题+错误答案 → 讲解。断言 A：结果卡片 rich-text 渲染可读（标题/加粗/列表正常，无原始 markdown 符号如 `**`、`##`），模块 tag 中文。存入错题本 → 断言 B：按钮变"✓ 已存入错题本"disabled。

## T2 举一反三 + 选错标色 + 解析 + 详解
举一反三（"出题中…（N秒）"计秒）→ 自算正确答案后故意点错误项。断言 C：所选错误项红色、正确项绿色、解析展开。点「用花生十三方法详解这道题」。断言 D：题目回填/答案=所选项，自动第二次讲解。

## T3 历史折叠
第二次讲解出现后。断言 E：旧卡片折叠为"🕓 历史讲解（点此展开/折叠）"一行；点击展开显示原题完整内容，再点复折叠。

## T4 错题本重做/删除
错题本 tab。断言 F：条目有"重做"，点击后 toast"题目已填入，先自己做一遍再点讲解"、切到拍题讲解、题目回填、答案空。删除 → 断言 G：showModal"确定删除这道错题？"，确认后条目消失。

## T5 薄弱分析 + 移动视口
删除前查看薄弱分析。断言 H：显示中文"资料分析 × 1"。把窗口/视口缩窄至 ~400px。断言 I：tabBar 与卡片布局不破版。
