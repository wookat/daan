# 考公错题助手（花生十三方法体系）

面向公务员考试备考者的错题讲解工具：上传错题截图或粘贴题目，AI 按「花生十三」公开教学体系的方法（ABRX、截位直除、415份数、假设分配、翻译推理等）分步讲解，分析错因，存入错题本并做薄弱点统计。

## 特性

- 📷 拍照/截图识题（多模态 LLM，无需独立 OCR）
- 🧭 题型路由：自动判断模块（资料分析/数量关系/言语/判断/常识/申论）并加载对应方法库
- 📖 严格引用方法库讲解；方法库没有的技巧会明确标注，不编造"花生十三方法"
- ❌ 错因分析：方法不会 / 看错题 / 计算失误 / 陷阱
- 📒 错题本 + 薄弱模块/题型统计
- 📱 移动端优先的网页（可加到主屏幕），后续可套微信小程序外壳

## 运行

```bash
cd backend
pip install fastapi uvicorn httpx python-multipart
export LLM_BASE_URL=...   # OpenAI 兼容 API
export LLM_API_KEY=...
export LLM_MODEL=gpt-5.5  # 需支持图片输入
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

打开 http://localhost:8000

## 方法库来源与版权

`knowledge/references/` 来自开源项目 [WangJunqing-coder/huasheng13-skill](https://github.com/WangJunqing-coder/huasheng13-skill)（README 声明 MIT），该项目基于花生十三**公开教学渠道**（B站公开课、知乎专栏等）整理，声明不含付费课程原文。本项目仅供个人学习辅助使用，不复制传播任何付费课程内容。

## 结构

```
backend/app/
  main.py    # FastAPI 路由
  engine.py  # 识题 → 题型路由 → 方法讲解
  kb.py      # 方法库加载与模块路由
  llm.py     # OpenAI 兼容客户端（支持图片）
  db.py      # 错题本 SQLite
frontend/index.html  # 移动端单页（零构建）
knowledge/references/  # 花生十三方法库（20 个文件）
```
