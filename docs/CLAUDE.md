# DeepSave Pro 操作手册（CLAUDE.md）

## 1. 权威信息来源
- `docs/QA.md` / `docs/QA2.md` / `docs/QA3.md` / `docs/QA4.md`：最终规格与冲突锁定（最高优先级）。
- `PRD.md` / `APP_FLOW.md` / `TECH_STACK.md` / `FRONTEND_GUIDELINES.md` / `BACKEND_STRUCTURE.md` / `IMPLEMENTATION_PLAN.md`：执行依据。

## 2. 变更规则
- 任何需求或技术栈调整必须更新对应文档并记录原因。
- 不得引入未在 `TECH_STACK.md` 中声明的库。

## 3. 开发约束
- 单用户系统，管理员账号。
- 本地优先与 NAS 低配可用为第一原则。
- 采集、处理、检索必须可观测、可重试。

## 4. 交付物清单
- 后端：FastAPI + Celery + Postgres（pgvector/pg_trgm）。
- 前端：Next.js + shadcn/ui + NextAuth。
- 工具：clipboard_monitor.py + Chrome 扩展。

## 5. 安全与密钥
- `APP_SECRET_KEY` 为 AES-GCM 加密盐，不可随意轮换。
- Access Token 只展示一次，DB 存 Hash。

## 6. 默认执行顺序
严格遵循 `IMPLEMENTATION_PLAN.md`，每一步完成后更新 `progress.txt`。
