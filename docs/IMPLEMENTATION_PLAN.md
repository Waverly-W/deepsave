# DeepSave Pro 实施计划（IMPLEMENTATION_PLAN）

> 原子化执行：每一步必须可验证、可回滚、可演示。

## Phase 0：文档与基线
1. 锁定文档：PRD / APP_FLOW / TECH_STACK / FRONTEND_GUIDELINES / BACKEND_STRUCTURE / IMPLEMENTATION_PLAN。
2. 建立 `CLAUDE.md` 与 `progress.txt` 作为操作手册与进度追踪。

## Phase 1：基础设施与骨架
3. 建立 Docker Compose（cpu/gpu profile）与服务端口规划。
4. 初始化 FastAPI/Next.js 工程骨架与依赖清单。
5. 完成 Postgres 初始化：pgvector + pg_trgm 扩展。
6. 初始化 Alembic 与首版 Schema 迁移。

## Phase 2：后端核心链路
7. 鉴权：/setup + /login + JWT + Access Token。
8. 采集入口：/items/ingest（异步） + 任务状态接口。
9. Redis 幂等锁与 Celery 基础任务框架。
10. Smart Scraper：HTTP → Playwright 兜底 + 资产落盘。

## Phase 3：AI 与检索
11. Router 规则与 AI 处理（摘要/标签/描述）。
12. 分块与向量化（bge-m3 / text-embedding-3-small）。
13. 建立 pgvector HNSW 索引与检索 API。
14. Layered Search + RRF 融合实现与测试。

## Phase 4：前端 MVP
15. 登录/初始化页面与鉴权保护。
16. 首页：Chat/Gallery Tabs + 搜索框。
17. 卡片列表（无限滚动）与任务状态轮询。
18. 详情页（Deep Reader）与阅读状态。
19. 归档/删除/重试等管理操作。

## Phase 5：采集工具
20. clipboard_monitor.py（配置 + 运行说明）。
21. Chrome 扩展（Popup + Context Menu）。

## Phase 6：稳定性与交付
22. 任务超时与重试策略完善（Soft/Hard）。
23. 日志清理与回收站自动清理。
24. 打包与部署文档（端口、环境变量、常见问题）。

## 验收标准（最小可交付）
- 从 URL 输入到可检索卡片 < 15s。
- 搜索混合召回有效（标题模糊 + 内容 + 语义）。
- 失败可观察、可重试。
- 单机低配可稳定运行。
