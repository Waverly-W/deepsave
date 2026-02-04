DeepSave Pro - 技术架构设计文档 (TDD)文档信息内容项目名称DeepSave Pro (SecondBrain-Hybrid)版本v1.0 (Architecture Design)作者System Architect适用范围后端开发, 运维部署, 数据库设计1. 架构总览 (System Overview)1.1 设计原则资源受限适应性 (Resource-Aware): 针对 NAS 环境（有限的内存/CPU）设计，采用异步队列机制削峰填谷，避免阻塞主线程。本地优先 (Local-First): 所有数据（数据库、向量索引、文件资产）必须持久化在 NAS 本地卷中，不依赖云端状态。模块化解耦 (Modular Decoupling): 采集(Scraper)、推理(Inference)、存储(Storage) 相互独立，便于替换 AI 模型后端（Local vs Cloud）。容器化交付 (Dockerized): 全栈服务通过 docker-compose 编排，一键部署。1.2 高层架构图 (High-Level Architecture)graph TD
    User[用户终端 (Web/Mobile/Extension)] -- HTTP/WebSocket --> Gateway[Nginx / Traefik]
    
    subgraph "Application Layer (Docker Containers)"
        Frontend[Next.js Frontend (SSR/UI)]
        Backend[FastAPI Backend (API/Controller)]
        Worker[Celery/ARQ Worker (Async Task Processor)]
    end
    
    subgraph "Data Layer (Persistence)"
        PG[(PostgreSQL/SQLite - 元数据)]
        Redis[(Redis - 消息队列/缓存)]
        Chroma[(ChromaDB - 向量索引)]
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
    Worker -- Read/Write --> Chroma
    Worker -- Save Assets --> FS
    Worker -- Inference --> Ollama
    Worker -- Inference --> CloudAPI
2. 技术选型 (Technology Stack)模块技术栈选型理由前端React, Next.js 14 (App Router), shadcn/uiSSR 对 SEO 友好（虽然是私有部署，但首屏快），现代化组件库开发效率高。后端APIPython 3.11, FastAPIPython 是 AI 生态首选，FastAPI 性能高且原生支持异步。任务队列Celery + Redis处理耗时的爬虫和 AI 推理任务，防止 HTTP 请求超时。爬虫Trafilatura (纯文本) + Playwright (渲染)混合策略：Trafilatura 极省资源，Playwright 应对复杂 SPA。关系型库PostgreSQL 15 (或 SQLite WAL)存储结构化数据。PG 适合并发，SQLite 适合低配单机。向量库ChromaDB轻量级、Python 原生友好，无需复杂的服务器配置即可嵌入运行。ORMPrisma (前端直连) 或 SQLAlchemy (后端)建议后端统一使用 SQLAlchemy (Async) 管理数据一致性。3. 数据流转逻辑 (Data Pipeline)核心业务逻辑在于“从链接到知识”的 ETL 过程。3.1 归档流程 (Ingestion Workflow)接收 (Reception): 用户发送 URL -> FastAPI /api/v1/inbox -> 生成 TaskID -> 立即返回 202 Accepted。调度 (Dispatch): 任务被推入 Redis processing_queue。采集 (Scraping):Worker 获取任务。尝试 Trafilatura 解析。若失败或内容过短 -> 启动 Playwright 截图并提取 DOM。保存原始 HTML/截图到 /data/artifacts/{uuid}/。路由 (Routing):利用轻量级规则或小模型判断内容类型（Article / Image / Code / Product）。处理 (Processing):根据路由结果，调用对应的 Agent。Case A (Local): 调用 http://ollama:11434/api/chat。Case B (Cloud): 调用 https://api.deepseek.com/v1/chat/completions。获取结构化 JSON：{ title, summary, tags, sentiment, entities }。索引 (Indexing):文本分块 (Chunking)。调用 Embedding 模型生成向量。写入 ChromaDB。通知 (Notification): 通过 WebSocket 推送“处理完成”消息给前端。4. 数据库设计 (Database Schema)采用关系型数据库存储核心业务数据。4.1 ER 图概念Item: 核心实体，代表一条收藏。Tag: 标签。ItemTag: 关联表。ProcessingLog: 处理日志（用于 debug）。Entity: 知识图谱实体（人名、地名、概念）。4.2 核心表结构定义 (SQL Definition)-- 核心条目表
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE,
    title TEXT,
    content_text TEXT, -- 清洗后的纯文本
    summary TEXT,      -- AI 生成的摘要
    source_type VARCHAR(20), -- 'article', 'image', 'video', 'code'
    
    -- 本地资产路径
    snapshot_path TEXT, -- 网页快照/原始图片路径
    cover_image_path TEXT, -- 封面图路径

    -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    
    -- AI 处理状态
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    embedding_status BOOLEAN DEFAULT FALSE
);

-- 标签系统
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(20) -- 'topic', 'mood', 'time', 'location'
);

CREATE TABLE item_tags (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- 知识实体 (用于知识图谱关联)
CREATE TABLE entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE item_entities (
    item_id UUID REFERENCES items(id),
    entity_id INTEGER REFERENCES entities(id),
    confidence_score FLOAT -- AI 对实体识别的置信度
);

-- 任务处理日志 (用于排查 NAS 性能问题)
CREATE TABLE task_logs (
    id UUID PRIMARY KEY,
    item_id UUID,
    step_name VARCHAR(50), -- 'scraping', 'inference', 'embedding'
    duration_ms INTEGER,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
4.3 向量库结构 (ChromaDB)ChromaDB 不使用 SQL 表，而是使用 Collection。Collection Name: knowledge_baseData Structure:ids: [ "item_uuid_chunk_1", "item_uuid_chunk_2" ]embeddings: [ [0.12, -0.4, ...], ... ]metadatas: [ { "item_id": "uuid", "source_type": "article", "year": 2024 }, ... ]documents: [ "chunk_text_content..." ]5. 目录与存储结构 (File System Layout)在 NAS 上的持久化目录映射设计：/deep_save_data/
├── pg_data/              # PostgreSQL 数据库文件
├── chroma_data/          # 向量数据库文件
├── redis_data/           # Redis 持久化
├── artifacts/            # 非结构化资产 (核心资产)
│   ├── {YYYY}/
│   │   ├── {MM}/
│   │   │   ├── {UUID}/
│   │   │   │   ├── original.html    # 原始网页 DOM
│   │   │   │   ├── full_page.png    # 网页长截图
│   │   │   │   ├── content.md       # 清洗后的 Markdown
│   │   │   │   └── media/           # 提取出的图片附件
│   │   │   │       ├── img_01.jpg
└── logs/                 # 系统运行日志
6. 接口设计规范 (API Design Strategy)遵循 RESTful 规范，核心端点如下：6.1 Ingestion APIPOST /api/v1/items/urlPayload: { "url": "https://...", "tags": ["manual_tag"] }Response: { "task_id": "..." }POST /api/v1/items/filePayload: Multipart Form Data (Image/PDF)6.2 Retrieval APIGET /api/v1/itemsQuery Params: page, limit, type, tag_idGET /api/v1/searchQuery Params: q (Query String), mode (hybrid/keyword/semantic)Logic:若 mode=hybrid，同时进行 SQL ILIKE 查询和 ChromaDB query_embeddings。使用 Reciprocal Rank Fusion (RRF) 算法合并结果。6.3 System APIGET /api/v1/system/statusResponse: CPU Usage, Memory Usage, Queue Length (防止 NAS 过载).POST /api/v1/system/configPayload: { "ai_provider": "ollama", "model_name": "qwen2.5:7b" }7. 扩展性设计 (Scalability & Constraints)7.1 应对 NAS 低性能的策略Rate Limiting: 限制爬虫并发数 (Concurrency Control)。例如 J4125 CPU 限制同时只能有 1 个 Playwright 实例，2 个 LLM 请求。Lazy Processing: 如果一次性导入 100 个链接，系统只立即处理前 5 个，其余进入 Backlog，利用夜间闲置时间处理。Embeddings Cache: 相同的文本块无需重复计算向量，增加缓存层。7.2 插件化架构设计 BaseAgent 抽象类，允许开发者编写 Python 脚本扩展新的处理能力（例如新增一个 "YouTube 视频总结 Agent"），只需继承类并实现 process(content) 方法，放入 plugins/ 目录即可自动加载。