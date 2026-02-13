# 产品需求文档（PRD）：DeepSave Pro - 混合架构 AI 智能知识中枢

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 项目名称 | DeepSave Pro（内部代号：SecondBrain-Hybrid） |
| 版本 | v1.1 (Tech Stack Update) |
| 状态 | 已对齐（Aligned to QA1-4） |
| 最后更新 | 2026-02-09 |
| 文档作者 | AI Product Manager |

## 1. 引言 (Introduction)

### 1.1 背景

在信息爆炸时代，用户普遍患有“数字松鼠病”，频繁收藏文章、图片和数据，但面临两大痛点：

- 只存不看：收藏即尘封，缺乏有效的回顾机制。
- 检索困难：传统的关键词搜索无法理解内容语境（如无法通过“悲伤”搜到一张雨天的图）。
- 算力与隐私的博弈：部分用户拥有高性能 NAS 且极度重视隐私，而另一部分用户希望在保护核心隐私的同时，利用云端大模型获得更快的响应速度。

### 1.2 产品愿景

打造一款运行在个人 NAS 上的、灵活兼容的 AI 知识管家。它允许用户自主掌握数据主权，同时提供“路由分发能力”和“主动唤醒机制”。系统支持在“纯本地隐私模式”和“高性能云端模式”之间无缝切换。

## 2. 目标与范围 (Goals & Scope)

### 2.1 商业/用户目标

- 零摩擦输入：将用户存入信息的耗时降至 < 2 秒。
- 兼容并包：同时支持低配置 NAS（使用云 API）和高配置 NAS（使用本地 LLM）。
- 结构化率 100%：所有存入内容必须经过 AI 清洗、打标、摘要。
- 主动召回率：通过每日回顾和上下文推荐，将“冷数据”的再次访问率提升 30%。

### 2.2 核心价值主张 (USP)

- Hybrid AI Architecture：混合动力引擎。既支持 Ollama 本地推理，也兼容 OpenAI/DeepSeek 等云端 API。
- Smart Scraper：资源自适应采集。优先使用轻量级解析，仅在必要时启动无头浏览器，节省 NAS 内存。
- Agent Router：基于内容的智能路由，针对不同类型内容分发给最合适的模型处理。

## 3. 市场分析与竞争格局 (Market Analysis)

| 竞品类型 | 代表产品 | 优势 | 劣势 | DeepSave Pro 机会点 |
| --- | --- | --- | --- | --- |
| 云端知识库 | Notion AI, Readwise | UX 极佳，多端同步，生态丰富 | 隐私风险，订阅费高，无法自定义模型 | 模型自主权，用户可换用更便宜或更强的 API |
| 本地笔记 | Obsidian, Logseq | 数据本地化，插件丰富 | 配置门槛高，缺乏自动化 ETL，移动端体验割裂 | 开箱即用的自动化，Web 端体验优于纯本地软件 |
| NAS 工具 | 群晖 Note Station | 部署在 NAS 上 | 体验陈旧，缺乏 AI 理解能力 | 现代化技术栈（Next.js），美观且智能 |

## 4. 用户画像 (User Personas)

- P1: 隐私极客 (The Privacy Geek)：拥有高性能 NAS，强制要求所有推理在本地完成（Ollama）。
- P2: 效率至上者 (The Efficiency User)：NAS 配置一般（如 J4125），但希望系统响应快，愿意填入 API Key 使用外部模型。
- P3: 开发者 (The Developer)：喜欢折腾，可能会利用 Next.js 扩展自己的前端组件。

## 5. 功能需求 (Functional Requirements)

### 5.1 模块一：全渠道采集 (Omni-Channel Ingestion)

目标：极大降低输入门槛，同时优化采集资源消耗。

| ID | 功能点 | 描述 | 优先级 |
| --- | --- | --- | --- |
| F-IN-01 | 剪贴板监听（Desktop） | 后台静默运行，识别剪贴板中的 URL 或图片，弹窗提示“一键归档”。 | P0 |
| F-IN-02 | 自适应爬虫（Smart Scraper） | 策略升级：<br/>1. Primary：使用轻量级 HTTP 库（如 Trafilatura/Goose）快速提取正文。<br/>2. Fallback：若提取失败或检测到强动态渲染（SPA），自动唤起 Headless Browser（Playwright）进行兜底渲染与抓取。 | P0 |
| F-IN-03 | 移动端捷径 | 提供 iOS 快捷指令或 Telegram/微信 Bot 接口，转发即存入（Phase 2+）。 | P2 |
| F-IN-04 | 扩展设置入口 | 扩展弹窗右上角齿轮进入设置页配置 API URL / Token。 | P0 |

### 5.2 模块二：智能路由与处理 (The Brain & Router)

目标：根据内容类型，分发给最合适的 Agent，支持模型后端配置。

- 配置层：用户可在设置中为每个 Agent 指定后端（Local/Cloud）。
- 前置路由：快速判断输入内容类型。

| 内容类型 | 处理 Agent (Role) | 建议模型（本地 / 云端） | 输出产物 |
| --- | --- | --- | --- |
| 通用文章 | Editorial Agent | 本地（Ollama）/ 云端（OpenAI Compatible，如 DeepSeek/Moonshot/Azure） | Markdown 笔记 + Meta 数据（情感/摘要/标签） |
| 技术/代码 | Tech Agent | 本地（Ollama）/ 云端（OpenAI Compatible） | 代码片段库 + 技术栈标签 |
| 视觉素材 | Vision Agent | 本地（MiniCPM-V）/ 云端（OpenAI Compatible Vision） | 图片描述文本 + 视觉标签 |

### 5.3 模块三：存储与向量化 (Storage & Embedding)

目标：建立可被自然语言检索的数据库。

| ID | 功能点 | 描述 | 优先级 |
| --- | --- | --- | --- |
| F-DB-01 | 混合存储 | 元数据与向量统一存入 PostgreSQL（pgvector）；文件存入 NAS 文件系统。 | P0 |
| F-DB-02 | 语义索引 | 使用 BGE-M3（本地）或 OpenAI Embedding（云端）对内容进行向量化。 | P0 |
| F-DB-03 | 知识图谱（轻量级） | 提取实体（Entities），建立双向链接（Phase 2+ 研究方向，MVP 不包含）。 | P2 |

### 5.4 模块四：交互与唤醒 (Interaction & Recall)

目标：现代化、响应式的前端体验。

| ID | 功能点 | 描述 | 优先级 |
| --- | --- | --- | --- |
| F-UI-01 | 现代化前端架构 | 采用 Next.js（App Router）+ React；UI 组件库使用 shadcn/ui（基于 Radix UI + Tailwind CSS），确保极简美学与高可访问性。 | P0 |
| F-UI-02 | 主页与时间线 | 主页以搜索为中心；时间线按创建时间浏览卡片列表。 | P0 |
| F-UI-03 | 混合搜索 | 标题/标签模糊匹配（pg_trgm）+ 正文检索（tsvector + jieba）+ 语义向量（pgvector）+ RRF 融合。 | P0 |
| F-UI-04 | 主页概览 | 统计概览、最近卡片、常用标签、最近搜索与快速入口。 | P0 |
| F-UI-05 | 左侧侧栏 | 图标化入口（主页/时间线/设置）。 | P0 |
| F-UI-06 | 键盘导航 | 搜索下拉支持 ↑↓ 选择、Enter 打开。 | P0 |
| F-UI-07 | 每日回顾 | 首页 Widget：“历史上的今天”、“被遗忘的角落”。 | P1 |

## 6. 非功能性需求 (Non-Functional Requirements)

### 6.1 性能与兼容性

- 前端性能：利用 Next.js 的 SSR/ISR 特性，确保在低性能 NAS 上首屏加载时间 < 1.5s。
- 爬虫策略：轻量级爬取耗时应 < 3s；无头浏览器兜底耗时允许 < 20s。
- 模型切换：切换本地/云端模型时无需重启服务。

### 6.2 隐私与安全

- API Key 管理：云端 API Key 必须加密存储在本地 .env 或数据库中，禁止明文展示。
- 网络控制：提供“仅内网访问”或“通过 Cloudflare Tunnel 公网访问”的配置向导。

## 7. 路线图 (Roadmap)

- Phase 1: MVP（核心闭环）- 预计周期：4 周
  - Stack：Next.js + FastAPI + PostgreSQL（pgvector/pg_trgm）
  - Core：实现混合爬虫（HTTP 优先，Playwright 兜底）
  - AI：接入 OpenAI Compatible API 作为默认，预留 Ollama 接口
  - Search：三层检索 + RRF 融合
  - UI：基于 shadcn/ui 搭建 Chat 和列表页面
- Phase 2: 本地化与视觉（Hybrid 升级）- 预计周期：6 周
  - Local LLM：完善 Ollama 接入与模型配置
  - Vision：本地与云端 Vision 能力对齐
  - Mobile：仅提供标准化 API，原生/捷径为后续扩展
- Phase 3: 体验优化（唤醒与可用性）- 预计周期：4 周
  - Recall：完善“每日回顾”算法
  - Optimization：针对 Next.js 进行移动端体验优化

## 8. 风险评估 (Risks)

- 依赖冲突：Python 后端（FastAPI）与 Node.js 前端（Next.js）需要在 NAS 上同时部署。对策：提供统一的 docker-compose.yml，一键拉起所有容器，屏蔽环境差异。
- API 成本失控：用户若大量存入图片并使用 GPT-4V，成本可能过高。对策：在设置中增加“Token 消耗预警”，或默认优先使用本地小模型处理大量图片。
- 爬虫失败率：部分网站反爬严格。对策：允许用户手动输入 Cookie 或 User-Agent，增强无头浏览器的伪装能力。
