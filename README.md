# Arcaea Save Tracker

一个纯前端的 Arcaea st3 存档解析工具。在浏览器端直接读取 SQLite 数据库，计算 PTT 并展示全量成绩。

**在线地址**: [https://amekuro.github.io/arcaea-save-tracker/](https://amekuro.github.io/arcaea-save-tracker/)

## 功能特性

- **浏览器端解析 st3** — 基于 sql.js (WASM)，无需后端，数据不离开本地
- **完整 PTT 计算** — 单曲 PTT、Best 30 均值、理论最高 PTT (Max PTT)
- **多维度筛选** — 按难度、曲包、等级、分数范围、日期范围、通关状态过滤
- **多语言支持** — 简体中文 / 繁体中文 / 日本語 / English，含自动回退
- **深色模式** — 浅色 / 深色 / 跟随系统，无白屏闪烁
- **曲绘展示** — 530+ 首曲目的高清曲绘，AVIF 压缩加载
- **自动更新** — CI 每日检查游戏版本更新与定数表同步

## 在线使用

1. 在 Android 设备上找到 st3 文件，路径通常为：
   ```
   /data/data/moe.low.arc/files/st3
   ```
2. 将 st3 文件传到电脑（或直接在手机浏览器中操作）
3. 打开 [在线地址](https://amekuro.github.io/arcaea-save-tracker/)，拖拽或点击上传 st3 文件
4. 解析完成后即可查看全量成绩、筛选、排序

> st3 是 Arcaea 的本地存档，本质为 SQLite 3 数据库。所有解析均在浏览器本地完成，不会上传任何数据。

## 本地开发

```bash
npm install
npm run dev
npm run build
```

需要 Node.js 20.19+ 或 22.12+。

## 工作原理

### st3 解析

用户上传 st3 文件后，前端流程如下：

1. **文件头校验** — 检查前 16 字节是否为 `SQLite format 3\0`
2. **表结构校验** — 确认数据库包含 `scores` 和 `cleartypes` 两张表
3. **SQL 查询** — LEFT JOIN 关联两表，获取每条成绩的分数、判定、通关状态
4. **PTT 计算** — 根据定数和分数套用社区反推的 PTT 公式：
   - `score >= 10,000,000` → `constant + 2.0`
   - `score >= 9,800,000` → `constant + 1.0 + (score - 9,800,000) / 200,000`
   - `score < 9,800,000` → `constant + (score - 9,500,000) / 300,000`（下限为 0）
5. **Best 30** — 按单曲 PTT 降序取前 30，计算均值

元数据解析（`songDataParser.js`）处理了多语言回退、难度专属曲名覆盖（如 PRAGMATISM -RESURRECTION-）、`jacketOverride` 曲绘切换、`dl_` 前缀修正等边界情况。

### 资产流水线

游戏曲绘和元数据通过 4 阶段脚本从官方 APK 中提取：

```
01_download_apk.js    → 从 lowiro 官方 API 下载最新 APK，含版本对比去重
02_extract_assets.js  → 解压 APK 中的 assets/songs/* 目录
03_process_images.js  → Sharp 多线程并发将 JPG 转 AVIF (quality=65)，优先选用 1080_ 高清版
04_fetch_constants.js → 从 Arcaea Wiki 拉取定数表，补充已下架曲目数据
```

脚本内置智能跳过：版本未变化时标记 `.skip_update`，后续阶段直接跳过；图片已转换且 `FORCE_REBUILD` 未设置时跳过。

### CI/CD

| 工作流 | 触发条件 | 功能 |
|--------|---------|------|
| `deploy.yml` | push 到 main | 构建并部署到 GitHub Pages |
| `update-assets.yml` | 每日 UTC 0:30 / 手动 | 执行完整 4 阶段流水线，更新曲绘和元数据 |
| `update-constants.yml` | 每 8 小时 / 手动 | 从 Wiki 拉取最新定数表 |

## 数据来源

| 数据 | 来源 |
|------|------|
| 曲绘、songlist、packlist | Arcaea 官方 APK (lowiro) |
| 定数表 | [Arcaea Wiki](https://wiki.arcaea.cn/) |
| 已下架曲目定数 | 脚本内硬编码补充 |

## 致谢

- [lowiro](https://lowiro.com/) — Arcaea 游戏开发与运营
- [Arcaea Wiki](https://wiki.arcaea.cn/) — 社区维护的定数表
- [sql.js](https://sql.js.org/) — 浏览器端 SQLite 引擎
- [Element Plus](https://element-plus.org/) — Vue 3 UI 框架

## License

本项目代码部分保留所有权利（All Rights Reserved），未经作者授权不得复制、修改或分发。

以下内容版权归原作者所有，不随本项目代码一同授权：

- **Arcaea 游戏资产**（曲绘、songlist、packlist 等）— 版权归 lowiro 所有，从官方 APK 中提取，仅供个人使用
- **定数表**（ChartConstant.json）— 由 [Arcaea Wiki](https://wiki.arcaea.cn/) 社区维护，遵循其各自的使用条款
