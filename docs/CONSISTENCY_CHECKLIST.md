# Release Consistency Checklist

每次发布前必须执行并存档（PR 描述或发布记录中附链接）。

## 1. 文档一致性

- [ ] `docs/PRD.md` 与 `docs/APP_FLOW.md` 的核心流程一致。
- [ ] `docs/TECH_STACK.md` 与实际依赖、容器镜像一致。
- [ ] `docs/BACKEND_STRUCTURE.md` 与当前数据库结构、API 路由一致。
- [ ] `docs/FRONTEND_GUIDELINES.md` 与当前页面路由/状态管理一致。
- [ ] `docs/DEPLOYMENT.md` 的环境变量、启动命令与 `docker-compose.yml` 一致。

## 2. 迁移与发布绑定

- [ ] 涉及 DB 变更的 PR 必须包含 Alembic 迁移文件。
- [ ] PR 描述中必须记录：`revision`、`down_revision`、回滚策略。
- [ ] 变更 `docs/QA*.md` 决策时，PR 必须注明受影响模块与迁移/数据修复路径。

## 3. 运行门禁

- [ ] `python3 -m compileall backend/app`
- [ ] `npm -C frontend run lint`
- [ ] `npm -C frontend run build`
- [ ] `APP_SECRET_KEY=<secret> docker compose config --quiet`

## 4. 回滚材料

- [ ] 上一版本镜像 tag（backend/frontend/worker/beat）可用。
- [ ] 迁移前数据库备份可恢复。
- [ ] 发布环境 `.env` 快照已存档。
