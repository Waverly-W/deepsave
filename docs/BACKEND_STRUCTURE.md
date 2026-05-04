# DeepSave Pro 后端结构（BACKEND_STRUCTURE）

## 1. 服务边界
- **API 服务（FastAPI）**：鉴权、采集入口、查询与管理接口。
- **Worker（Celery）**：抓取、AI 处理、向量化、索引更新。
- **PostgreSQL**：关系数据 + 向量 + 检索。
- **Redis**：任务队列与幂等锁。

## 2. 目录建议
- `app/main.py`：FastAPI 入口
- `app/api/`：路由
- `app/core/`：配置、鉴权、日志
- `app/models/`：SQLAlchemy 模型
- `app/schemas/`：Pydantic DTO
- `app/services/`：业务逻辑
- `app/worker/`：Celery 配置与任务
- `app/scraper/`：抓取与解析
- `app/ai/`：LLM/Embedding/Vision
- `app/search/`：FTS/向量检索

## 3. 关键数据表（MVP）
**items**
- id, url, normalized_url, title, summary, content_text
- content_tokens, cached_tags, source_type, meta_json
- processing_status, content_revision, analysis_revision, processing_target_revision
- is_archived, is_deleted, is_read
- created_at, updated_at

**tags / item_tags**
- tags: id, name, category
- item_tags: item_id, tag_id

**item_chunks**
- id, item_id, chunk_index, chunk_text, embedding(vector(1024))

**users**
- id, password_hash, last_password_reset_at

**api_keys**
- id, key_hash, user_id, label, created_at

**ai_settings**
- llm_api_key_encrypted, llm_base_url, llm_model
- summary_system_prompt, summary_user_prompt_template
- polish_system_prompt, polish_user_prompt_template
- vision_user_prompt
- embedding_api_key_encrypted, embedding_base_url, embedding_model, embedding_dimensions

**site_configs**
- domain, cookies(encrypted)

**task_logs**
- id, item_id, step_name, duration_ms, status, error_message, created_at

## 4. 处理流程（Worker）
1. 入队 → Redis 幂等锁（TTL=600s）。
2. 抓取：轻量 HTTP 抽取（不启用无头浏览器兜底）。
3. 路由：article/image/code。
4. 结构化：摘要/标签/元数据。
5. 向量化：chunk(1000/overlap 200) → embedding(1024)。
6. 写入 DB → 更新状态。

## 5. 检索策略
- Layer 1：pg_trgm（title, cached_tags）
- Layer 2：tsvector（content_tokens）
- Layer 3：pgvector（item_chunks）
- 融合：RRF，k=60

## 6. 认证
- 登录：FastAPI 签发 JWT（HS256，24h）。
- 前端：NextAuth 仅做 Session 容器。
- Access Token：32位随机 hex；DB 存 SHA-256。

## 7. 主页概览接口
- `GET /items/overview`：返回统计与标签聚合（总量、未读、处理中、待重算、今日新增、最近保存、Top tags）。

## 8. 配置与密钥
- `APP_SECRET_KEY`：AES-GCM 加密 API Key。
- `RRF_K_CONSTANT`：默认 60，可配置。

## 9. AI 设置与 Prompt 配置
- 运行时优先级：数据库 `ai_settings` > 环境变量 > 内置默认模板。
- Prompt 模板字段已暴露为可配置项（摘要/标签、润色、图片描述），用于系统任务执行时动态注入。
- 配置接口：
  - `GET /system/ai-settings`：读取当前生效配置（包含是否已保存 API Key）。
  - `PUT /system/ai-settings`：更新模型、Key、Prompt 模板（支持部分字段 patch）。
  - `POST /system/ai-settings/test`：测试 LLM/Embedding 连通性与延迟。
