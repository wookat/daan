# R77 设计：首页 hero 每日一练完成态回显

## 取证（2026-08-31）

- 生产首页 hero「今日全站同题 10 题 · 已有 N 人完成」（home.vue dsMeta）只反映全站参与数，与本人状态无关：完成当日一练后回到首页，文案不变、无成绩/名次/连续天数回显，用户无法确认「我今天做过了、成绩如何」，也失去 streak 的每日提醒锚点（粉笔每日一练首页卡完成后显示「已完成 · 连续 N 天」）。
- practice.vue submit 返回已含 my_right/my_rank/streak（R73/R76），但只在完成页展示、未持久化——数据现成，纯前端补一条本地回显链路即可，零后端改动。

## 方案

1. practice.vue daily submit `.then` 中把结果落本地：`uni.setStorageSync('dailyDone:' + anonUid(), { date, right, total, rank, streak })`（按 uid 隔离，防同设备切换身份串用；旧日期数据自然失效）。
2. home.vue hero-ds 行：读取该 key 且 date 为今天时改为「今日全站同题 · 已完成 答对 N/10 · 第 R 名<template streak≥2> · 🔥 连 X 天</template>」；否则维持原文案。

## 非目标

- 不加接口、不做跨设备同步（登录态成绩同步为后续候选）、不改今日任务三件套。

## 验收

- 生产真实作答完成每日一练 → 回首页 hero 显示完成态（答对/名次/连续天数）；
- 未完成/新 uid 首页文案与原来一致；跨日后（模拟改本地 date）回退原文案；
- 1440/375 无溢出、console 0 error；测试数据清理、保护 uid 零 mutation。
