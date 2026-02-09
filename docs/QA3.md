DeepSave Pro - 最终工程规格与参数锁定 (Q&A Specs Part 3)

文档信息

内容

关联项目

DeepSave Pro (SecondBrain-Hybrid)

版本

v1.0 (Engineering Lock)

决策人

Product Manager & System Architect

状态

最终锁定 (Final Locked)

注意

本此文档覆盖 Part 1/2 中关于 ChromaDB 的所有描述

A. 技术栈与依赖锁定 (Tech Stack)

1. 向量库最终方案

决策：pgvector (PostgreSQL Extension)。

覆盖：废弃 Part 2 Q25 的 ChromaDB 方案，执行 Part 2 Q5 的 "PostgreSQL Only" 战略。

理由：在 NAS 低资源环境下，运行单个 Postgres 容器（同时处理关系型数据 + 向量 + 全文检索）比同时维护 Postgres + ChromaDB 两个数据库容器节省约 400MB+ 内存，且消除了数据同步一致性问题。

2. pg_trgm 与 pgvector 安装

决策：Dockerfile 层面处理。

实现：使用 pgvector/pgvector:pg16 官方镜像作为基础镜像（已包含 pgvector）。在 /docker-entrypoint-initdb.d/ 下放置 00-init-extensions.sql：

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


3. 新增依赖清单

决策：全部接受。

更新：

Frontend: NextAuth.js (v5 beta or v4 stable).

Backend: pyperclip (仅脚本用), requests, colorgram.py (提取色板), sentence-transformers (本地 Embedding).

Database: sqlalchemy, alembic, asyncpg, pgvector-python.

B. 认证与 Token (Auth)

4. JWT 签发与策略

签发者：FastAPI (Backend)。

算法：HS256。

有效期：Access Token 24小时。无 Refresh Token（MVP 简化逻辑，过期后前端自动跳回登录页）。

NextAuth 角色：仅作为前端 Session 容器，透传后端的 JWT。

5. 扩展/脚本专用 Access Token

决策：32字符随机十六进制字符串 (Random Hex String)。

存储：存入 DB api_keys 表，字段包括 key_hash, user_id, label, created_at.

性质：永不过期，除非用户手动在 UI 撤销（删除）。不是 JWT。

6. APP_SECRET_KEY

格式：32字节 Base64 字符串（即 openssl rand -base64 32 生成）。

轮换：MVP 不支持自动轮换。修改环境变量后，所有存量 JWT 失效（用户需重新登录），但数据库中的加密字段（如 OpenAI Key）将无法解密（因此 MVP 禁止轮换加密盐，或需提供重新加密脚本）。

C. 初始化与账号管理 (Setup)

7. /setup 安全性

逻辑：Next.js Middleware 拦截 /setup 路由。

判断：请求后端 /api/v1/system/init-status。若返回 { initialized: true } (即 users 表行数 > 0)，强制重定向至 /login。

8. CLI 重置密码影响

后果：不会使现有 JWT 立即失效（因为 JWT 是无状态的）。但用户下次登录必须使用新密码。API Key (Access Token) 不受影响。

9. 密码哈希

算法：bcrypt。

参数：rounds (cost) = 12。

D. 数据模型与字段映射 (Data Model)

10. JSON DTO 映射清单

权威：以 SQL Schema 为准。

映射规则：

meta.title -> items.title

meta.author -> items.meta_json (JSONB 字段，存杂项)

analysis.summary -> items.summary

analysis.tags -> 写入 tags 表并建立多对多关系。

11. tech_stack 存储

决策：复用 tags 表。

区分：Tag 表增加 category 字段。tech_stack 中的 "Python" 存为 { name: "python", category: "tech_stack" }。

12. sentiment (情感)

决策：存入 metadata 并不建立索引。仅用于前端展示，暂不用于检索过滤。

13. is_archived (归档)

决策：保留。

定义：is_archived = TRUE 表示“从主 Feed 流中隐藏，但搜索可见”。

删除：UI 提供“移入垃圾桶（软删除）”和“彻底删除（硬删除）”两个层级。

E. 采集与幂等 (Ingestion)

14. URL 规范化规则 (顺序)

Lower Scheme/Host: HTTP://EXAMPLE.COM/Path -> http://example.com/Path

Sort Query: ?b=2&a=1 -> ?a=1&b=2

Remove UTM: 移除 utm_*, ref, source 等。

Remove Fragment: 移除 # 后内容。

Trim Slash: 移除尾部 / (除非是根路径)。

15. Upsert 时间戳

逻辑：

created_at: 保持不变 (保留用户的原始收藏记忆)。

updated_at: 更新为当前时间。

16. Redis 幂等锁 TTL

时长：10 分钟 (600s)。

理由：防止 Worker 意外 Crash 导致 URL 永久不可重试。

17. 手动重新处理

逻辑：强制覆盖锁。用户点击 UI "Re-process" 按钮时，API 强制删除 Redis 锁并重新入队。

18. Playwright SPA 失败

策略：保存 HTML，标记状态。

状态：processing_status = 'partial_fail'。用户依然可以看到部分内容（如有），并可手动触发重试。

F. AI 输出与容错 (AI Output)

19. 最小必需字段与默认值

title: 默认为 URL。

summary: 默认为 "No summary generated."。

tags: 默认为空数组 []。

20. OCR 实现

决策：仅依赖 Vision 模型。

理由：MiniCPM-V 等多模态模型具备极强的 OCR 能力，无需引入 Tesseract 增加镜像体积。

21. 色板提取

决策：使用 colorgram.py。

理由：确定的算法比 AI 生成的 HEX 码更稳定、更廉价。Worker 下载图片后，本地运行算法提取 Top 5 颜色存入 JSONB。

22. 摘要约束

Prompt 约束："Summarize in 3 bullet points, plain text, no markdown headers."

截断：后端不强行截断，由前端 CSS 控制展示行数（line-clamp）。

23. 标签规范

决策：统一小写 + 去除空格。

去重：Python 3 -> python3。不处理同义词（如 js vs javascript），留给用户手动整理。

G. 检索与排序 (Search)

24. FTS 实现

决策：Generated Column (PostgreSQL 12+)。

SQL：

ALTER TABLE items ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
) STORED;
CREATE INDEX idx_fts ON items USING GIN (search_vector);


注：Tag 不在 items 表，需通过 Join 查询或触发器同步到 items 表的一个冗余字段用于搜索。MVP 建议将 tag names 拼接后存入 items.cached_tags 字段并纳入 FTS。

25. RRF 空值处理

逻辑：若向量搜索返回空（例如服务未启动），RRF 退化为纯 FTS 排序。

26. 默认排序

决策：创建时间倒序 (Newest First)。

记忆：前端 localStorage 记录用户上次选择的排序方式。

H. UI/UX 细节

27. Gallery 封面图回退链

优先级：Snapshot Screenshot > OpenGraph Image > Favicon > Default Placeholder (SVG)。

28. /status 状态来源

字段：items 表新增 is_read (Boolean, default False)。

变更：点击卡片进入详情页/阅读页时，触发 API PATCH /items/{id} { is_read: true }。

29. Recall 去重

决策：前端 Session Storage 去重。

逻辑：在当前浏览器会话中，记录已展示过的 ID。刷新页面（F5）会重置，保持“每次刷新都有新惊喜”的体验，但单次会话内不重复。

I. 部署与运维 (Ops)

30. Docker Compose Profiles

Profile cpu: frontend, backend, worker, db (pg), redis.

Profile gpu: 上述所有 + ollama.

31. API 端口暴露

决策：暴露 8356 端口。

限制：默认绑定 127.0.0.1:8356。若需局域网访问，用户需修改 compose 文件为 0.0.0.0:8356。

安全：所有 API 请求必须带 Authorization Header（Access Token 或 JWT），否则 401。

32. Alembic 迁移

触发：容器启动脚本自动执行 (entrypoint.sh).

命令：alembic upgrade head。

失败：若迁移失败，容器退出。不允许跳过，防止代码与数据库结构不一致。