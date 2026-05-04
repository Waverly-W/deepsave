# 部署与运行指南

## 1. 前置条件
- Docker + Docker Compose (v2)。
- 确保端口可用：3000 (前端)、8356 (后端)。
- NAS/内网部署建议为固定局域网 IP。

## 2. 快速启动（CPU）
1. 在仓库根目录创建 `.env`。
2. 写入最小必需配置（示例）：

```bash
ALIYUN_API_KEY=your_aliyun_key
NEXTAUTH_SECRET=please-change-me
NEXTAUTH_URL=http://127.0.0.1:3000
APP_SECRET_KEY=please-change-me-too
CORS_ALLOW_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

3. 启动服务：

```bash
docker compose --profile cpu up -d
```

4. 数据库迁移由 backend 启动时自动执行（`alembic upgrade head`）。
   如需手动执行（排障/预检）：

```bash
docker compose exec -T backend alembic upgrade head
```

本机直连运行（非容器）可选：

```bash
cd backend
alembic upgrade head
```

或在仓库根目录：

```bash
alembic -c backend/alembic.ini upgrade head
```

5. 首次初始化：打开 `http://<host>:3000/setup`，设置管理员密码。
6. 登录入口：`http://<host>:3000/login`。

## 3. GPU 可选（Ollama）
如需 GPU 配置并启动 Ollama：

```bash
docker compose --profile gpu up -d
```

## 4. 运行与升级
- 开发热更新：`docker-compose.override.yml` 默认会挂载源码目录。
- 生产建议禁用 override：  
  `docker compose -f docker-compose.yml --profile cpu up -d`
- 依赖或基础镜像变更后：  
  `docker compose up -d --build`
- 前端静态资源（`frontend/public`）变更后：必须重建前端镜像  
  `docker compose build frontend && docker compose up -d frontend`
- 查看日志：  
  `docker compose logs -f backend worker beat`

## 5. 端口与服务清单
- 前端：`0.0.0.0:3000` (Next.js)
- 后端：`0.0.0.0:8356` (FastAPI + Celery API)
- 数据库：`127.0.0.1:5432` (PostgreSQL)
- Redis：`127.0.0.1:6379`
- Ollama：`127.0.0.1:11434` (仅 GPU profile)

## 6. 环境变量清单

### 必需（生产建议配置）
- `ALIYUN_API_KEY`：Aliyun text-embedding-v4 Key。
- `NEXTAUTH_SECRET`：NextAuth 会话加密密钥。
- `NEXTAUTH_URL`：前端访问地址（局域网请用实际 IP）。
- `APP_SECRET_KEY`：后端加密/JWT 主密钥，必须设置且不能使用弱值（如 `change-me`）。
- `CORS_ALLOW_ORIGINS`：逗号分隔的允许来源列表。

### 可选（前端）
- `API_BASE_URL`：Next.js 服务端代理使用的后端地址（容器内默认 `http://backend:8356`）。
- `NEXT_PUBLIC_API_BASE_URL`：可选，仅在需要让浏览器绕过前端代理、直接请求后端时设置；局域网访问建议留空，避免 CORS。

### 可选（后端：模型与超时）
- `ALIYUN_EMBEDDING_MODEL`：默认 `text-embedding-v4`。
- `ALIYUN_EMBEDDING_DIMENSIONS`：默认 `1024`。
- `ALIYUN_EMBEDDING_BASE_URL`：默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- `LLM_API_KEY` / `OPENAI_API_KEY`：摘要/图片描述（未配置会降级为默认摘要）。
- `LLM_BASE_URL` / `OPENAI_BASE_URL` / `OPENAI_API_BASE`：OpenAI 兼容接口地址。
- `LLM_MODEL` / `OPENAI_MODEL`：默认 `gpt-4o-mini`。
- `LLM_MAX_INPUT_CHARS`：摘要输入截断阈值（默认 12000）。
- `LLM_TIMEOUT_SOFT_S` / `LLM_TIMEOUT_HARD_S`：摘要超时。
- `LLM_RETRY_ATTEMPTS` / `LLM_RETRY_BASE_S`：摘要重试配置。
- `VISION_API_KEY` / `VISION_BASE_URL` / `VISION_MODEL` / `VISION_TIMEOUT_S`：图片描述模型。
- `EMBEDDING_TIMEOUT_SOFT_S` / `EMBEDDING_TIMEOUT_HARD_S`：Embedding 超时。
- `IMAGE_FETCH_TIMEOUT_S`：图片下载超时。
- `INGEST_LOCK_TTL_S`：入队 URL 幂等锁 TTL（秒，默认 600）。
- `INGEST_LOCK_HEARTBEAT_S`：worker 对 item 锁的续约间隔（秒，默认 120）。
- `ARTIFACTS_BASE_DIR`：抓取产物目录（默认 `/data/artifacts`）。
- `AUTH_ENFORCED`：是否强制业务接口鉴权（默认 `true`）。
- `ALLOW_WEAK_SECRET_FOR_DEV`：仅本地开发允许弱密钥（默认 `false`）。
- `CORS_ALLOW_ORIGINS`：显式允许的前端 Origin 列表，逗号分隔。
- `CORS_ALLOW_ORIGIN_REGEX`：可选的 Origin 正则；为空时使用默认私有局域网 Origin 规则。
- `SSRF_PROTECTION_MODE`：`warn|enforce`（默认 `enforce`）。
- `INGEST_DOMAIN_ALLOWLIST`：可选，逗号分隔域名白名单。
- `AI_RESOURCE_CONCURRENCY`：AI 处理资源并发槽位（默认 2）。
- `SCRAPER_RESOURCE_CONCURRENCY`：抓取资源并发槽位（默认 2）。
- `TASK_LOG_ERROR_MAX_LEN`：`task_logs.error_message` 截断长度（默认 1000）。

### 可选（后端：检索与回收）
- `RRF_K_CONSTANT`：RRF 融合常量（默认 60）。
- `RRF_TYPE_WEIGHTS`：按类型加权（例：`article:1.0,image:1.2,note:0.9`）。
- `SEARCH_CACHE_TTL_S` / `SEARCH_CACHE_MAX_KEYS`：热查询缓存 TTL 与容量。
- `EMBEDDING_CACHE_SIZE`：Embedding 本地缓存容量（0 为关闭）。
- `RECYCLE_BIN_RETENTION_DAYS`：回收站保留天数（默认 30）。
- `TASK_LOG_RETENTION_DAYS`：任务日志保留天数（默认 7）。

### 可选（外部数据库/Redis）
- `DATABASE_URL`：默认 `postgresql+asyncpg://deepsave:deepsave@db:5432/deepsave`。
- `REDIS_URL` / `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND`：默认指向内置 Redis。

## 7. 常见问题排查
- 502/500：先确认 `backend` 容器健康，再执行迁移 `alembic upgrade head`。
- 本机执行 `alembic upgrade head` 报 `No 'script_location' key found`：在 `backend/` 目录执行，或使用 `alembic -c backend/alembic.ini upgrade head`。
- 本机执行 Alembic 报 `No module named 'pgvector'`：先安装后端依赖 `cd backend && pip install -r requirements.txt`。
- CORS 报错：确保 `CORS_ALLOW_ORIGINS` 包含前端完整地址（含端口）。
- `[next-auth][JWT_SESSION_ERROR]`：`NEXTAUTH_SECRET` 变更或不一致，清理浏览器 Cookie 并重启前端。
- 任务长期 pending：检查 `worker` 容器日志与 Redis 连接；确认 `ALIYUN_API_KEY` 生效。
- /search 422：`q` 不能为空，确保前端不会发送空查询。
- 局域网访问：将 `NEXTAUTH_URL` 与 `CORS_ALLOW_ORIGINS` 设置为局域网地址。
- npm 安装 `@tiptap/extension-markdown` 404：该包不在公开 npm，改用 `tiptap-markdown`。
- worker 报错 `Future ... attached to a different loop`：避免跨事件循环复用 asyncpg 连接；确保 AI 设置读取使用任务内 session。
- 编辑后无“待重算”：需先手动保存内容，`content_revision` 变化后才会出现待重算提示。
- 品牌图标 404（如 `/brand/logo-mark.svg`）：确认前端镜像已包含 `public/`，执行 `docker compose build frontend && docker compose up -d frontend`。
- 前端 hydration warning（`data-note-width`/`data-editor-text-size` 不一致）：升级到最新前端代码后重启前端；该问题由 SSR 与客户端初始偏好不一致引起，已在偏好初始化逻辑中修复。
