# DeepSave Pro 上线修复清单（repair）

## 1. 文档目标与范围

本文件用于指导 **上线前架构修复**，聚焦以下目标：

1. 封堵高风险安全缺口（鉴权、密钥、输入校验）。
2. 提升发布稳定性（迁移自动化、持久化、健康检查、回滚）。
3. 建立最小可观测性（任务、队列、失败定位）。
4. 保证“文档决策”与“代码实现”一致。

生成日期：2026-02-13  
适用分支：发布分支（建议 `release/hardening-2026-02`）

---

## 2. 优先级定义（必须遵守）

- `P0`：不完成不得上线。
- `P1`：建议上线后一周内完成，或在预发布窗口一并完成。
- `P2`：中期优化，可排入后续迭代。

---

## 3. P0 改造清单（上线阻断项）

### P0-1 服务端统一鉴权与授权

#### 问题

当前后端核心业务路由未统一验证 `Authorization`，存在未授权访问风险。

#### 目标

1. 所有业务接口默认需要鉴权。
2. 同时支持：
   - JWT（前端 NextAuth 会话使用）
   - Access Token（扩展/脚本使用）
3. 仅放行白名单接口：`/health`、`/auth/login`、`/auth/setup`、`/system/init-status`。

#### 代码改造

1. 新增 `backend/app/core/auth.py`
   - 解析 `Authorization: Bearer <token>`
   - 先按 JWT 解析，失败再按 Access Token 哈希校验
   - 输出统一身份上下文（`user_id`, `auth_type`, `token_id`）
2. 新增 `backend/app/repositories/api_key_repo.py` 方法
   - `get_by_hash()`
   - `touch_last_used()`
   - `revoke()`
   - `list_by_user()`
3. 修改路由依赖
   - `backend/app/api/items.py`
   - `backend/app/api/search.py`
   - `backend/app/api/tags.py`
   - `backend/app/api/system.py`
   - 使用 `Depends(require_auth)` 或 `APIRouter(..., dependencies=[Depends(require_auth)])`
4. JWT 失效策略落地（与 QA 决策对齐）
   - 在 JWT 校验中增加 `iat` 与 `users.last_password_reset_at` 对比

#### 验收标准

1. 无鉴权访问 `/items`, `/search`, `/tags`, `/system/keys` 返回 `401`。
2. JWT 可访问，Access Token 可访问。
3. 失效 JWT（`iat < last_password_reset_at`）返回 `401`。

#### 回滚方案

1. 保留原路由定义，使用 feature flag：`AUTH_ENFORCED=true/false`。
2. 若出现阻断，可临时设为 `false` 恢复旧行为（仅限内网临时排障，24h 内恢复）。

---

### P0-2 密钥安全与启动 Fail-Fast

#### 问题

存在 `APP_SECRET_KEY=change-me` 默认值与 fallback，密钥错误配置无法阻止服务启动。

#### 目标

1. 生产环境密钥缺失或弱值时，服务直接拒绝启动。
2. 禁止默认弱密钥在任何容器生效。

#### 代码改造

1. 新增 `backend/app/core/startup_checks.py`
   - 校验 `APP_SECRET_KEY` 非空且不为 `change-me`
   - 长度与熵校验（建议 Base64 32 字节）
2. 在 `backend/app/main.py` 启动时执行检查
3. 移除 fallback
   - `backend/app/core/security.py`
   - `backend/app/core/encryption.py`
4. 更新 `docker-compose.yml`
   - `APP_SECRET_KEY: ${APP_SECRET_KEY?required}`
   - 删除明文 `change-me`

#### 验收标准

1. 未设置 `APP_SECRET_KEY` 时容器启动失败并输出明确错误。
2. 使用弱值（如 `change-me`）时启动失败。

#### 回滚方案

保留 `ALLOW_WEAK_SECRET_FOR_DEV=true` 开关，仅限本地开发使用，生产禁用。

---

### P0-3 SSRF 与危险 URL 输入防护

#### 问题

`/items/ingest` 当前对 URL 安全校验不足，存在对内网地址访问风险。

#### 目标

1. 只允许 `http/https`。
2. 禁止访问：
   - localhost/loopback
   - 私网地址（RFC1918）
   - 链路本地
   - 保留地址段与 metadata 服务地址
3. 防 DNS Rebinding（解析后校验 A/AAAA 地址）。

#### 代码改造

1. 新增 `backend/app/utils/url_safety.py`
   - URL 规范化与主机解析
   - `ipaddress` 范围拦截
2. 在 `backend/app/services/ingest_service.py` 入队前调用校验
3. `backend/app/schemas/items.py` 将 URL 字段升级为更严格校验
4. 如需抓取白名单域名，新增 `INGEST_DOMAIN_ALLOWLIST` 配置

#### 验收标准

1. 提交 `http://127.0.0.1:...` 返回 `400`。
2. 提交内网地址（如 `http://192.168.1.2`）返回 `400`。
3. 普通公网 URL 仍可正常入队。

#### 回滚方案

`SSRF_PROTECTION_MODE=warn|enforce`，先 `warn` 观察，48h 后切 `enforce`。

---

### P0-4 Access Token 生命周期（可撤销、可审计）

#### 问题

当前仅能创建 Token，不能列出、撤销、追踪最近使用时间。

#### 目标

1. 新增 Token 列表/撤销 API。
2. Token 使用后更新 `last_used_at`。
3. 设置页可撤销 Token。

#### 数据库迁移

新增 Alembic 迁移：`backend/alembic/versions/0017_api_keys_lifecycle.py`

建议字段：

1. `api_keys.revoked_at TIMESTAMPTZ NULL`
2. `api_keys.last_used_at TIMESTAMPTZ NULL`
3. 索引：`idx_api_keys_user_revoked`

#### 接口改造

1. 新增：
   - `GET /system/keys`
   - `DELETE /system/keys/{key_id}`
2. 修改：
   - 鉴权层在 Access Token 成功后调用 `touch_last_used`

#### 前端改造

1. `frontend/lib/fetchers.ts` 增加 list/revoke 方法
2. `frontend/app/settings/settings-shell.tsx` 增加 Token 列表与撤销按钮

#### 验收标准

1. 新创建 Token 可在列表看到（明文仅创建时展示一次）。
2. 撤销后该 Token 立即返回 `401`。
3. `last_used_at` 可更新。

---

### P0-5 抓取产物持久化（artifacts 卷）

#### 问题

抓取产物默认写 `/data/artifacts`，但 Compose 未挂载对应卷，容器重建后数据可能丢失。

#### 目标

1. 产物目录持久化到 Docker volume/NAS。
2. 路径可配置。

#### 代码与部署改造

1. `docker-compose.yml`
   - 新增 volume：`artifacts_data`
   - backend/worker 挂载：`/data/artifacts`
2. 新增环境变量：
   - `ARTIFACTS_BASE_DIR=/data/artifacts`
3. `backend/app/scraper/artifacts.py`
   - 默认目录从硬编码改为读取环境变量

#### 验收标准

1. 触发一次 Playwright 抓取后，重建容器文件仍在。
2. 备份脚本可包含该卷。

---

### P0-6 数据库迁移自动执行（启动前）

#### 问题

文档已约定自动迁移，但当前镜像启动未执行 `alembic upgrade head`。

#### 目标

1. backend 启动前自动迁移，失败则退出。
2. worker/beat 在 backend ready 后再启动。

#### 改造步骤

1. 新增 `backend/entrypoint.sh`
   - 执行 `alembic upgrade head`
   - 成功后启动 uvicorn
2. `backend/Dockerfile`
   - 复制并设置 entrypoint
3. `docker-compose.yml`
   - backend 增加 healthcheck
   - worker/beat 依赖 backend healthy（而非 started）

#### 验收标准

1. 数据库落后版本时，启动 backend 自动升级成功。
2. 迁移失败时 backend 退出，worker 不启动。

---

### P0-7 前端构建与 lint 门禁修复

#### 问题

当前 `npm run lint` 失败，且前端容器以 `next dev` 运行，不适合生产。

#### 目标

1. lint 可通过。
2. 前端镜像使用生产模式（build + start）。

#### 改造步骤

1. 修复 lint 错误
   - `frontend/components/ui/minimal-tiptap/hooks/use-throttle.ts`
   - 去除失效规则注释或补齐 eslint 规则配置
2. `frontend/Dockerfile` 改为 multi-stage
   - builder：`npm ci && npm run build`
   - runner：`npm run start`
3. 发布门禁新增：
   - `npm -C frontend run lint`
   - `npm -C frontend run build`

#### 验收标准

1. lint/build 全绿。
2. 生产容器不再使用 `next dev`。

---

## 4. P1 改造清单（稳定性增强）

### P1-1 队列并发模型优化（避免全局串行）

1. 当前全局锁 `processing:global` 会导致并发退化。
2. 建议改为：
   - item 级幂等锁 + 模型资源 semaphore（LLM/Playwright 各自限流）
   - 锁续约机制（长任务）

### P1-2 可观测性补齐

1. `/health` 拆分：
   - `liveness`
   - `readiness`（DB/Redis/Celery）
2. `/system/status` 增加队列长度、失败计数、最近 1h 成功率
3. `task_logs` 实际写入处理阶段耗时与错误

### P1-3 数据一致性修复

1. `ItemRepository.upsert` 冲突更新时明确重置：
   - `is_deleted=false`
   - `is_archived=false`
   - 根据策略控制 `processing_target_revision`
2. 明确“重复 URL 且已软删”的恢复行为

### P1-4 运行策略完善

1. 为 backend/frontend/worker/beat 增加 `restart: unless-stopped`
2. 增加资源限制（CPU/内存）
3. 增加日志滚动策略，防止磁盘写满

---

## 5. P2 改造清单（中期）

### P2-1 扩展安全收敛

1. 缩小 `extension/manifest.json` 的 `host_permissions`
2. 增强 Token 本地保护（最小可行：过期检查 + 清空入口 + 授权失败提醒）

### P2-2 搜索与缓存优化

1. Embedding 缓存（相同 chunk 去重）
2. 查询热词缓存
3. RRF 参数实验化（按内容类型调权重）

### P2-3 文档与实现一致性治理

1. 新增一致性校验清单：每个发布版本都做
2. QA 决策变更必须绑定 PR 与迁移记录

---

## 6. 实施步骤（建议顺序）

### 阶段 A：安全封口（预计 2-3 天）

1. 完成 `P0-1` 鉴权闭环。
2. 完成 `P0-2` 密钥 fail-fast。
3. 完成 `P0-3` SSRF 防护。

阶段验收：

1. 未授权请求全部 `401`。
2. 默认弱密钥无法启动。
3. 内网地址 ingest 被拒绝。

### 阶段 B：发布稳定（预计 2 天）

1. 完成 `P0-5` artifacts 持久化。
2. 完成 `P0-6` 自动迁移与健康检查。
3. 完成 `P0-7` 前端生产化与 lint 门禁。

阶段验收：

1. 容器重建不丢抓取产物。
2. 迁移失败可阻断启动。
3. lint/build 通过，前端生产模式运行。

### 阶段 C：Token 生命周期（预计 1-2 天）

1. 完成 `P0-4` 迁移与 API。
2. 完成设置页 Token 列表与撤销。

阶段验收：

1. Token 可撤销且立即失效。
2. `last_used_at` 持续更新。

---

## 7. 数据库迁移计划

### 必做迁移

1. `0017_api_keys_lifecycle.py`
   - 新增 `revoked_at`, `last_used_at`
2. 如需用户安全增强（可选）
   - 为 `users.last_password_reset_at` 增加默认回填策略

### 迁移执行

1. 本地验证：
   - `alembic upgrade head`
   - `alembic downgrade -1`
   - `alembic upgrade head`
2. 预发布环境：
   - 备份 DB 后执行升级
3. 生产：
   - 维护窗口执行
   - 观察错误率 30 分钟

---

## 8. 发布前验证清单（Go-Live Gate）

必须全部通过：

1. `python3 -m compileall backend/app`
2. `npm -C frontend run lint`
3. `npm -C frontend run build`
4. `docker compose config --quiet`
5. 鉴权回归：
   - 无 Token 访问业务 API -> `401`
   - JWT/Access Token 访问 -> `200`
6. 迁移回归：
   - 空库初始化可启动
   - 增量迁移可启动
7. 持久化回归：
   - 抓取后重建容器，artifacts 仍存在
8. 关键链路回归：
   - ingest -> worker -> search 全流程成功

---

## 9. 回滚预案（必须提前准备）

### 应用回滚

1. 保留上一版本镜像 tag（backend/frontend/worker）
2. 出现严重异常时回滚镜像并重启

### 数据回滚

1. 迁移前执行 `pg_dump`
2. 如迁移导致不可用，使用备份恢复

### 配置回滚

1. 保留旧版 `.env` 快照
2. 回滚时同步恢复 compose 配置

---

## 10. 责任分工建议

1. 后端负责人
   - P0-1, P0-2, P0-3, P0-4, P0-6
2. 前端负责人
   - P0-4（设置页）、P0-7
3. 运维负责人
   - P0-5, P0-6, 发布与回滚演练
4. QA
   - 按第 8 节 Gate 清单逐项签字

---

## 11. 完成定义（Definition of Done）

满足以下条件才算“可上线”：

1. 所有 `P0` 完成并通过 Gate。
2. 发布与回滚演练至少各 1 次。
3. 文档同步更新：
   - `docs/DEPLOYMENT.md`
   - `docs/APP_FLOW.md`
   - `docs/BACKEND_STRUCTURE.md`
   - `docs/progress.txt`

