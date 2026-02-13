# DeepSave Pro - 技术架构设计文档（TDD）

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 项目名称 | DeepSave Pro（SecondBrain-Hybrid） |
| 版本 | v1.0 (Architecture Design) |
| 作者 | System Architect |
| 适用范围 | 后端开发、运维部署、数据库设计 |

## 1. 架构总览 (System Overview)

### 1.1 设计原则

- 资源受限适应性 (Resource-Aware)：针对 NAS 环境（有限的内存/CPU）设计，采用异步队列机制削峰填谷，避免阻塞主线程。
- 本地优先 (Local-First)：所有数据（数据库、向量索引、文件资产）必须持久化在 NAS 本地卷中，不依赖云端状态。
- 模块化解耦 (Modular Decoupling)：采集（Scraper）、推理（Inference）、存储（Storage）相互独立，便于替换 AI 模型后端（Local vs Cloud）。
- 容器化交付 (Dockerized)：全栈服务通过 docker-compose 编排，一键部署。

### 1.2 高层架构图 (High-Level Architecture)

```mermaid
graph TD
    User[用户终端 (Web/Mobile/Extension)] -- HTTP --> Gateway[Nginx / Traefik]

    subgraph "Application Layer (Docker Containers)"
        Frontend[Next.js Frontend (SSR/UI)]
        Backend[FastAPI Backend (API/Controller)]
        Worker[Celery Worker (Async Task Processor)]
    end

    subgraph "Data Layer (Persistence)"
        PG[(PostgreSQL - 元数据/向量/检索)]
        Redis[(Redis - 消息队列/缓存)]
        FS[NAS FileSystem (Images/HTML Snapshots)]
    end

    subgraph "AI Inference Layer (Hybrid)"
        Ollama[Local LLM Service (Optional)]
        CloudAPI[Cloud Providers (OpenAI/DeepSeek)]
    end

    Gateway --> Frontend
    Gateway --> Backend
    Frontend -- API Calls --> Backend
    Backend -- Push Task --> Redis
    Redis -- Pop Task --> Worker
    Worker -- Read/Write --> PG
    Worker -- Save Assets --> FS
    Worker -- Inference --> Ollama
    Worker -- Inference --> CloudAPI
```

## 2. 技术选型 (Technology Stack)

| 模块 | 技术栈 | 选型理由 |
| --- | --- | --- |
| 前端 | React, Next.js 14（App Router）, shadcn/ui | SSR 对首屏加载友好，现代化组件库提升开发效率。 |
| 后端 API | Python 3.11, FastAPI | Python 是 AI 生态首选，FastAPI 性能高且原生支持异步。 |
| 任务队列 | Celery + Redis | 处理耗时的爬虫和 AI 推理任务，防止 HTTP 请求超时。 |
| 爬虫 | Trafilatura（纯文本）+ Playwright（渲染） | 混合策略：Trafilatura 极省资源，Playwright 应对复杂 SPA。 |
| 关系型库 | PostgreSQL 16（pgvector/pg_trgm） | 统一单库，支持向量检索与模糊检索。 |
| 向量库 | pgvector（HNSW） | 复用 PostgreSQL，降低部署与一致性成本。 |
| 检索 | pg_trgm + tsvector + jieba | 标题/标签模糊匹配 + 正文分词检索。 |
| ORM | SQLAlchemy（Async） | 后端统一管理数据一致性。 |

## 3. 数据流转逻辑 (Data Pipeline)

核心业务逻辑在于“从链接到知识”的 ETL 过程。

### 3.1 归档流程 (Ingestion Workflow)

1. 接收 (Reception)：用户发送 URL -> FastAPI `/items/ingest` -> 生成 TaskID -> 立即返回 `202 Accepted`。
2. 调度 (Dispatch)：任务被推入 Celery 默认队列 `celery_default`。
3. 采集 (Scraping)：Worker 获取任务；尝试 Trafilatura 解析；若失败或内容过短 -> 启动 Playwright 渲染并提取 DOM；保存 `content.html`（必需）与可选 `screenshot.png` 到 `/data/artifacts/{uuid}/`。
4. 路由 (Routing)：利用轻量级规则判断内容类型（Article / Image / Code）。
5. 处理 (Processing)：根据路由结果，调用对应的 Agent。
   - Case A (Local)：调用 `http://ollama:11434/api/chat`
   - Case B (Cloud)：调用 `https://api.deepseek.com/v1/chat/completions`
6. 结构化结果：获取结构化 JSON（例如 meta/analysis/tags 等字段），写入 DB 映射字段。
7. 索引 (Indexing)：文本分块（Chunking）；调用 Embedding 模型生成向量；写入 PostgreSQL（pgvector）。
8. 通知 (Notification)：前端轮询任务状态直到完成。

## 4. 数据库设计 (Database Schema)

采用关系型数据库存储核心业务数据。

### 4.1 ER 图概念

- Item：核心实体，代表一条收藏。
- Tag：标签。
- ItemTag：关联表。
- ItemChunk：向量分块表（pgvector）。
- ProcessingLog：处理日志（用于 debug）。

### 4.2 核心表结构定义 (SQL Definition)

```sql
-- 核心条目表
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    normalized_url TEXT UNIQUE NOT NULL,
    title TEXT,
    summary TEXT,
    content_text TEXT, -- HTML 正文（可编辑，分析时提取纯文本）
    content_format VARCHAR(20) NOT NULL DEFAULT 'html', -- html
    content_tokens TEXT, -- 分词后的正文
    cached_tags TEXT, -- 冗余标签字符串（用于模糊检索）
    source_type VARCHAR(20) NOT NULL DEFAULT 'article', -- article, image, code, note
    meta_json JSONB DEFAULT '{}'::jsonb, -- 作者、发布时间、色板等
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, partial_fail
    content_revision INTEGER DEFAULT 0,
    analysis_revision INTEGER DEFAULT 0,
    processing_target_revision INTEGER,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Full Text Search 向量（基于 content_tokens）
ALTER TABLE items ADD COLUMN content_search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple', coalesce(content_tokens, ''))
) STORED;

-- 标签系统
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    category VARCHAR(20) DEFAULT 'general',
    UNIQUE (lower(name), category)
);

CREATE TABLE item_tags (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- 向量分块表
CREATE TABLE item_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT,
    embedding VECTOR(1024)
);

-- 任务处理日志（用于排查 NAS 性能问题）
CREATE TABLE task_logs (
    id UUID PRIMARY KEY,
    item_id UUID,
    step_name VARCHAR(50), -- 'scraping', 'inference', 'embedding'
    duration_ms INTEGER,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.3 向量表结构 (pgvector)

向量数据统一存放在 PostgreSQL `item_chunks` 表中：

- `item_id`：关联到 `items`。
- `chunk_text`：用于高亮或回显。
- `embedding`：`VECTOR(1024)`，HNSW 索引加速检索。

## 5. 目录与存储结构 (File System Layout)

在 NAS 上的持久化目录映射设计：

```text
/deep_save_data/
├── pg_data/              # PostgreSQL 数据库文件
├── redis_data/           # Redis 持久化
├── artifacts/            # 非结构化资产（核心资产）
│   ├── {YYYY}/
│   │   ├── {MM}/
│   │   │   ├── {UUID}/
│   │   │   │   ├── content.html     # 网页 DOM Snapshot（必需）
│   │   │   │   ├── screenshot.png   # 网页长截图（可选）
│   │   │   │   ├── content.html     # 清洗后的 HTML（可选）
│   │   │   │   └── media/           # 提取出的图片附件
│   │   │   │       ├── img_01.jpg
└── logs/                 # 系统运行日志
```

## 6. 接口设计规范 (API Design Strategy)

遵循 RESTful 规范，核心端点如下：

### 6.1 Ingestion API

```text
POST /auth/login
Body: { "password": "..." }
Return: { "token": "JWT" }

POST /items/ingest
Body: { "url": "https://...", "source_type": "article|image|code|note", "content_text": "...", "title": "..." }
Return: 202 Accepted { "task_id": "...", "item_id": "..." }

GET /items/tasks/{task_id}
Return: { "status": "pending|processing|completed|failed|partial_fail" }
```

### 6.2 Retrieval API

```text
GET /items
Query Params: cursor, limit, type, archived=false

GET /items/overview
Return: { total_count, unread_count, processing_count, stale_count, today_count, latest_created_at, top_tags[] }

GET /items/{id}

PATCH /items/{id}
Body: { is_archived?, is_deleted?, is_read?, title?, content_text? }

DELETE /items/{id}

GET /search
Query Params: q, type
Logic:
  - Layer 1: pg_trgm（title + cached_tags）
  - Layer 2: tsvector（content_tokens）
  - Layer 3: pgvector（item_chunks.embedding）
  - 使用 Reciprocal Rank Fusion (RRF) 融合
```

### 6.3 System API

```text
GET /system/status
Response: CPU Usage, Memory Usage, Queue Length（防止 NAS 过载）

POST /system/keys
Return: { "access_token": "..." }  # 仅展示一次
```

## 7. 扩展性设计 (Scalability & Constraints)

### 7.1 应对 NAS 低性能的策略

- Rate Limiting：限制爬虫并发数（Concurrency Control）。例如 J4125 CPU 限制同时只能有 1 个 Playwright 实例，2 个 LLM 请求。
- Lazy Processing：如果一次性导入 100 个链接，系统只立即处理前 5 个，其余进入 Backlog，利用夜间闲置时间处理。
- Embeddings Cache：相同的文本块无需重复计算向量，增加缓存层。

### 7.2 插件化架构设计

BaseAgent 抽象类允许开发者编写 Python 脚本扩展新的处理能力（例如新增一个 “YouTube 视频总结 Agent”），只需继承类并实现 `process(content)` 方法，放入 `plugins/` 目录即可自动加载。
