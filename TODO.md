迁移到 TypeScript 是一个非常明智的选择。Arcaea 的数据结构（尤其是 `songlist.json` 的多重嵌套和多语言字段）非常复杂，使用 TS 的 `interface` 能极大地减少你在处理 `title_localized` 或 `difficulties` 时的心智负担。

以下是我对整个项目的代码审计、依赖清单以及迁移建议：

### 1. 核心依赖清单 (Dependencies)

如果你从头开始初始化 TS 项目，这些是你需要的核心包：

前端运行依赖:

* `vue` & `element-plus` : UI 框架。
* `@element-plus/icons-vue` & `@vicons/ionicons5` : 图标库。
* `sql.js` : 最核心的解析库。用于在浏览器端直接读取二进制 `st3` 数据库。迁移到 TS 时，记得安装 `@types/sql.js` 。
* `axios` : 用于脚本端拉取 Wiki 和官网数据（前端读取本地 JSON 也可以直接用原生的 `fetch` ）。

自动化工作流依赖 (Scripts):

* `sharp` : 用于将提取的图片批量转换为高压缩比的 `.avif` 。
* `cheerio` : 用于解析 Arcaea Wiki 的 HTML 页面，提取定数表。
* `node-fetch` (或 Node 18+ 原生 fetch): 用于下载 APK。


### 2. 项目架构设计审阅

你可以将项目拆分为以下几个逻辑模块：

#### A. 数据模型层 (Data Models - TS 迁移重点)

在 JS 中我们直接 `...songInfo` 飞起，但在 TS 中，建议定义以下接口：

* `SongInfo` : 对应 `songlist.json` 中的单曲项。
* `ScoreRecord` : 对应 `st3` 数据库中 `scores` 表的一行数据。
* `ProcessedRecord` : 经过 `songlist` 关联、PTT 计算、多语言回退处理后的最终展示对象（即 `ResultTable` 接收的对象）。

#### B. 数据提取与计算 (Logic/Utils)

* `st3` 解析: 利用 `sql.js` 执行 SQL。注意：`sql.js` 需要加载一个 `.wasm` 文件，在 Vite 中需要配置 `vite-plugin-wasm` 或者手动拷贝到 `public` 。
* PTT 计算器 (`ptts.js`): 公式已经验证成熟。迁移时只需把 `(constant, score)` 的入参定义清楚即可。
* 元数据翻译器 (`songDataParser.js`): 这块逻辑目前比较分散。在重写时，可以写一个 `LanguageManager` 类来集中处理 `zh-Hans -> zh-Hant -> ja -> en` 的回退逻辑。

#### C. 自动化流水线 (CI/CD Scripts)

* APK 下载器: 依赖官网接口，注意 `version.json` 的版本对比逻辑。
* 资产转换器: Sharp 的性能非常好，记得保留 `FORCE_REBUILD` 标志，否则在 CI 中每次都转码 500+ 图片太浪费时间。
* 定数抓取器: Wiki 的 HTML 结构偶尔会变，建议在重写时增加一些 Try-Catch 的容错逻辑。


### 3. 优化与算法改进建议 (细节)

既然你要重写，可以顺带优化这几个痛点：

1. 模糊搜索算法: 目前前端搜索是简单的 `includes` 。既然你有 `search_title` 数组，可以实现更强的搜索逻辑（比如输入 `msh` 能搜到 `Misdeed` ）。
2. 定数表热更新: 目前依赖 CI/CD 全量构建。可以考虑让前端优先尝试 fetch 远程最新的定数补丁 JSON，如果失败再退回本地 `data/constants.json` 。
3. 跑马灯组件性能: 虽然我已经通过 `IntersectionObserver` 做了优化，但在 TS 中你可以把 `MarqueeManager` 封装成一个标准的 Hooks (`useMarquee`)，让逻辑更加 Vue 3 化。
4. 性能瓶颈: Arcaea 530+ 曲目不算多，但在做 `st3` 关联时，如果使用嵌套循环会变慢。建议在解析之初就把 `songlist.json` 转换为一个以 `songId` 为 key 的 `Map` 。


### 4. 推荐的 TS 重构步骤

1. 定义类型声明文件: 先写 `types.ts` 。
2. 重写 Utils: 先把 PTT 计算和 `st3` 读取逻辑迁移。
3. 重构组件: 利用 `<script setup lang="ts">` 。
4. 严格模式: 开启 `tsconfig.json` 的 `strict: true` ，虽然痛苦，但能帮你找出很多多语言字段可能为 `undefined` 的隐患。

这个项目虽然不大，但涵盖了 二进制处理、自动化脚本、复杂多语言 UI 等多个有趣的技术点。祝你重写顺利，早日刷出理想的 PTT！