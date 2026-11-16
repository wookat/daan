# 轮48：实施无外部依赖高杠杆项（access log 持久化归档 + Flutter APK 构建冒烟）

分支：`devin/1786305124-r48`（自 main f1b300e 切出）。

## 0. 选项与理由

r47 建议清单中，站长平台验证/小程序上架/订阅消息开闸均依赖老板资源（账号/DNS/AppID），A/B 漏斗复盘无自然样本可分析。剩余零外部依赖两项本轮全做：

1. **access log 持久化归档**（P1）：r43/r47 两次发现同机 Caddy 被其他项目重载导致 kaogong 日志重建、观测窗口丢失（r47 时窗口只剩约 2 小时）。SEO/获客趋势观测是当前主线，管道不稳则周报失真——修复它是观测线的前置条件。
2. **Flutter APK 构建冒烟**（P2）：r44-47 Flutter 累积多轮 parity 改动，一直只有 `flutter analyze` 静态验证，从未产出可运行包；跑通一次 APK 构建可兜底确认工程可编译、依赖齐全。

## 1. access log 持久化归档

- 新增 `scripts/archive_access_log.py`：按日志行内 `ts` 增量归档到 `/home/ubuntu/kaogong-reports/access-archive/access-YYYYMMDD.jsonl`；`.state` 记录已归档最大 ts，幂等可高频执行；兼容轮转后的 `.gz` 分片。Caddy 日志再被重建也不丢已归档窗口。
- `deploy/cron_access_report.sh` 升级：周报优先从归档聚合（回退原始日志），生成前先归档一次；归档保留 90 天。
- 服务器已部署并验证：
  - 首跑归档 280 行；复跑 `archived 0 new lines`（幂等确认）。
  - 新增小时级 cron：`17 * * * * … archive_access_log.py … # kaogong-access-archive`（最坏丢 1 小时窗口）。
  - 手动触发周报：从归档正常产出（280 请求 / /tiku/ 34 / 爬虫 0）。
- 注：`scripts/`、`deploy/` 不在 deploy_h5.sh rsync 清单内，已手动同步到服务器（延续 r44 约定）。

## 2. Flutter APK 构建冒烟

- 本机补装 Android SDK（cmdline-tools + platforms;android-34/35 + build-tools;34.0.0，flutter 自动补 NDK/CMake）。
- 两处工程问题本轮修复并提交：
  - `android/gradle.properties`：`-Xmx8G -XX:MaxMetaspaceSize=4G` 超出常见 8G 构建机内存，Gradle daemon 被 OOM 杀（首次构建失败实测）→ 降为 `-Xmx4G -XX:MaxMetaspaceSize=1G`，重建通过。
  - `android/app/build.gradle.kts`：`minSdk = 23` 每次构建都被 Flutter 工具自动改写为 `flutter.minSdkVersion`（flutter_local_notifications 等插件要求 ≥24），改为跟随 `flutter.minSdkVersion`（实际解析 24）避免反复 dirty。
- 冒烟结果：`flutter build apk --debug` 成功，产物 `app-debug.apk`（155MB debug 包），apkanalyzer 校验 applicationId `com.kaogong.kaogong_app`、minSdk 24、targetSdk 36。release 签名包需 keystore（未配置，留待发版时）。

## 3. 部署回归 + 健康快扫（全绿）

- 本轮无 H5/后端代码变更，`deploy_h5.sh` 空部署复验：本机/线上 bundle 一致（index-Oz4likn-.js），7 项接口回归全 200。
- 健康快扫：active **112,962**；hs 结论字母一致性 0 异常；options 非 JSON 0；`(cid:` 乱码 0；空 hs 仅 2 条已知台账题（changshi:655861 / panduan:334296）。

## 4. 下一批建议（轮49 候选）

1. 站长平台验证（Bing WMT/百度）+ 小程序提审：获客最高杠杆，需老板账号/DNS/AppID（继续催办）。
2. A/B 漏斗与 reminder 埋点复盘：待自然样本积累（archive 管道本轮已稳，观测口径不再丢窗口）。
3. Flutter release 发版链路：keystore 签名配置 + release 构建（需老板决定签名归属）。
4. LLM key/ACCESS_CODE 补发后恢复 AI 讲解与后台完整功能。

## 5. 环境限制

- 本轮零生产数据变更、零测试数据产生。
- LLM 凭据仍缺失，AI 功能保持降级；未新增任何 AI provider 或分发渠道。
