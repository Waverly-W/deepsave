DeepSave Pro - 最终规格锁定: 核心冲突与API契约 (Q&A Specs Part 4)

文档信息

内容

关联项目

DeepSave Pro (SecondBrain-Hybrid)

版本

v1.0 (Development Ready)

决策人

Product Manager & System Architect

状态

执行锁定 (Execution Locked)

注意

本此文档补充并修正前三部分的细节，具有最高优先级

A. 检索与向量 (Retrieval & Vector Strategy)

1. 最终检索策略 (Search Strategy)

决策：混合分层检索 (Hybrid Layered Search)。

逻辑：

Layer 1 (标题/标签 - 模糊匹配): 使用 pg_trgm (Trigram)。

场景：用户输入 "pyth" 匹配 "Python"，或中文短语模糊匹配。

Layer 2 (正文 - 全文检索): 使用 Python 侧分词 (Jieba) + Postgres tsvector。

逻辑：Worker 在处理文章时，调用 jieba 将中文分词为空格分隔的字符串 ("我 爱 编程"), 存入 content_tokens 字段。DB 中对该字段建 GIN 索引。查询时用 websearch_to_tsquery('simple', ...)。

Layer 3 (语义 - 向量检索): pgvector HNSW 索引。

组合：RRF(Layer 1 + Layer 2, Layer 3)。即：传统关键词搜索（标题权重高+正文权重低）与向量搜索结果进行融合。

2. 索引字段与类型

GIN (pg_trgm): items.title, items.cached_tags (将 tags 拼接成字符串存储的冗余字段)。

GIN (tsvector): items.content_search_vector (Generated Column based on content_tokens).

HNSW (vector): item_chunks.embedding.

3. 向量表结构 (Vector Schema)

决策：独立表 item_chunks。

结构：

id: UUID (PK)

item_id: UUID (FK -> items.id, ON DELETE CASCADE)

chunk_index: Integer (顺序)

chunk_text: Text (切片后的文本，用于高亮展示)

embedding: Vector(1024)

4. 索引参数 (Index Params)

类型：HNSW (Hierarchical Navigable Small World)。

理由：查询速度快，召回率高，且不需要像 IVFFLAT 那样预训练聚类中心。

参数：m=16, ef_construction=64。

5. 向量维度 (Dimensions)

锁定：1024。

模型对齐：

Local: 使用 BAAI/bge-m3 (原生 1024 维)。

Cloud: 使用 Aliyun text-embedding-v4，并设置 API 参数 dimensions=1024 (Key=ALIYUN_API_KEY)。

6. 图片检索 (Image Search)

决策：仅依赖文本向量。

逻辑：不生成 Image Embedding。而是将 Vision Agent 生成的详细文本描述 (Description) 进行向量化。搜索 "雨天" 时，匹配的是描述中生成的 "rainy day" 文本向量。

B. 数据模型与生命周期 (Data Model)

7. Items 表最终字段清单
| 字段名 | 类型 | 约束/默认 | 说明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, Default gen_random_uuid() | |
| url | Text | Unique, Not Null | 原始 URL |
| normalized_url | Text | Unique, Not Null | 清洗后的 URL (去参数/Hash)，用于去重 |
| title | Text | Nullable | 标题 |
| summary | Text | Nullable | 摘要 |
| content_text | Text | Nullable | 纯文本正文 (用于展示) |
| content_tokens | Text | Nullable | 分词后的文本 (用于 FTS) |
| source_type | Varchar(20) | Not Null, Default 'article' | enum: article, image, code, note |
| meta_json | JSONB | Default {} | 存作者、发布时间、色板等 |
| processing_status | Varchar(20) | Default 'pending' | pending, processing, completed, failed, partial_fail |
| is_archived | Boolean | Default false | |
| is_deleted | Boolean | Default false | 软删除标记 |
| is_read | Boolean | Default false | 阅读状态 |
| created_at | Timestamptz | Default now() | |
| updated_at | Timestamptz | Default now() | |

8. URL 去重

唯一约束：基于 normalized_url。

处理：入库前先规范化。若冲突，更新该记录的 updated_at 并触发重新处理，但不新增行。

9. 软删除与归档

字段：is_archived (归档, 搜索可见, 列表不可见), is_deleted (回收站, 搜索不可见)。

清理：无 deleted_at 字段。使用 updated_at + is_deleted=true 判断。Celery Beat 每天清理 is_deleted=true AND updated_at < NOW() - INTERVAL '30 DAYS' 的记录。

10. Tags 唯一性

约束：Unique(lower(name), category)。

说明：允许同名不同类（如 #Rust (Game) 和 #Rust (Lang)），但 MVP 阶段通常不强制区分 Category，默认 Category 为 'general'。

11. Knowledge Graph

锁定：MVP 删除。不建 entities 表，不处理实体关系。

C. API 设计 (API Contract)

12. MVP 核心 API 清单

POST /auth/setup (Body: password -> Return: JWT)

POST /auth/login (Body: password -> Return: JWT)

GET /system/status (Init status, CPU/Mem)

POST /items/ingest (Body: {url, source_type?, content_text?, title?} -> Return: {task_id})

GET /items/tasks/{task_id} (Poll status)

GET /items (Params: cursor, limit, type, archived=false)

GET /items/{id}

PATCH /items/{id} (Body: {is_archived, is_deleted, is_read, tags...})

DELETE /items/{id} (Hard delete)

GET /search (Params: q, type)

POST /system/keys (Generate Access Token)

13. 采集接口响应

类型：异步 (Asynchronous)。

响应：202 Accepted. Body: { "task_id": "uuid...", "item_id": "uuid..." (预生成) }。

14. 通知方式

决策：轮询 (Short Polling)。

理由：MVP 避免引入 WebSocket 服务端（FastAPI WS 在某些反代下不稳定）。前端每 2s 轮询一次 GET /items/tasks/{ids} 直到完成。

15. 速率限制

限制：无特定 QPS 限制（单用户）。

Body 限制：Nginx/FastAPI 限制 20MB (为了支持大图上传)。

D. 处理管线与容错 (Processing Pipeline)

16. Celery 队列

队列：单队列 celery_default。

并发：Worker 进程数固定为 2（为了省 NAS 内存）。Playwright 和 LLM 任务混跑，依靠 Celery 自身的预取机制调度。

17. 任务超时 (Timeouts)

Playwright: Soft 30s / Hard 45s.

LLM: Soft 60s / Hard 90s.

Embedding: Soft 10s / Hard 20s.

18. LLM 失败重试

策略：指数退避 (Exponential Backoff)。

次数：重试 3 次 (Delay: 2s, 4s, 8s)。

Status:

pending: 队列中。

processing: 处理中。

completed: 成功。

failed: 彻底失败（需人工介入重试）。

partial_fail: 抓取成功但 AI 总结失败（保留原文）。

E. 安全与鉴权 (Security)

19. Access Token 存储

算法：SHA-256 (无盐，因 Token 本身是 32 字节高熵随机数，且数据库已位于内网/加密卷，碰撞或彩虹表攻击风险极低，优先保证性能)。

存储：DB 存 Hash 值。用户创建时只显示一次明文。

20. JWT 失效

策略：被动失效。

逻辑：JWT 包含 iat (Issued At)。修改密码时，记录 last_password_reset_at 时间戳到用户表。鉴权时，若 token.iat < user.last_password_reset_at，则拒绝请求。

21. 公网暴露

推荐：Tailscale / Cloudflare Tunnel。

强制：应用层不强制 HTTPS（因无法自动管理证书），但在文档中用粗体红字警告不要直接端口映射 HTTP 到公网。

F. 前端交互与数据加载 (Frontend)

22. 列表分页

策略：无限滚动 (Infinite Scroll)。

参数：使用 cursor (基于 created_at 时间戳) 而非 offset，防止新数据插入导致翻页重复。limit 默认 20。

23. Chat/Gallery 数据源

决策：同一个 /search 接口。

参数：

Chat 模式：调用 /search?q=... 返回混合结果。

Gallery 模式：调用 /items?type=image (纯浏览) 或 /search?q=...&type=image (搜图)。

24. 重新处理 (Reprocess)

逻辑：覆盖 (Overwrite)。

字段：重置 summary, tags, content_tokens。保留 created_at, is_favorite。不保留旧摘要历史。

G. 采集工具交付 (Tools Delivery)

25. clipboard_monitor.py 配置

来源：.env 文件 (与脚本同目录)。

内容：API_URL=http://nas-ip:8000, ACCESS_TOKEN=xxx.

26. 浏览器扩展功能

锁定：

Icon 状态：灰色(未登录/网络错)、蓝色(就绪)、绿色(成功)、红色(失败)。

Popup：显示当前 URL 和 Title。

Action：点击 "Save" 按钮发送。

Context Menu：右键选中文本 -> "Save to DeepSave as Note" (将选中文本作为 content_text，URL 为来源)。

排除：暂不支持截图上传、标签预填写（保持极简，标签由 AI 生成）。
