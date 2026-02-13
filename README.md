# DeepSave Pro

本地优先的知识中枢：将网页、笔记、图片与代码统一保存、分析、检索，并以多级标签树组织你的知识库。

## 项目功能
- 多来源采集：URL、手动笔记、浏览器插件快速保存
- 智能处理：摘要、标签、多级标签、向量化与全文检索
- 标签树浏览：类似文件夹的层级导航，按标签聚合笔记
- 手动润色：即时润色与打字机效果重写
- 任务队列：后台异步分析、可重跑与状态跟踪
- 本地部署：NAS 友好，数据与模型配置均可自托管

## 架构概览
- 前端：Next.js (App Router) + Tailwind + shadcn/ui
- 后端：FastAPI (Async)
- 任务队列：Celery + Redis
- 数据库：PostgreSQL 16 + pgvector/pg_trgm
- 存储：NAS 文件系统（原始素材与衍生文件）

## 快速启动（Docker）
1. 在仓库根目录创建 `.env`，填入最小配置：

```bash
ALIYUN_API_KEY=your_aliyun_key
NEXTAUTH_SECRET=please-change-me
NEXTAUTH_URL=http://127.0.0.1:3000
APP_SECRET_KEY=please-change-me-too
CORS_ALLOW_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

2. 启动服务（CPU）：

```bash
docker compose --profile cpu up -d
```

3. 首次或升级后执行数据库迁移：

```bash
docker compose exec -T backend alembic upgrade head
```

4. 初始化与登录：
- 初始化：`http://<host>:3000/setup`
- 登录：`http://<host>:3000/login`

## API 与鉴权
- 令牌生成：在设置页生成 Access Token（仅显示一次，请妥善保存）。
- 鉴权方式：请求头 `Authorization: Bearer <token>`。
- 接口基址：`http://<host>:8356`。

示例：添加知识卡片（笔记）

```bash
curl -X POST "http://<host>:8356/items/ingest" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "source_type": "note",
    "title": "Sample title",
    "content_text": "Sample content"
  }'
```

## 数据目录与备份
- 数据库与 Redis 使用 Docker 卷：`pg_data`、`redis_data`。
- 建议定期备份 PostgreSQL；Redis 主要是队列/缓存，可选备份。

导出备份（PostgreSQL）：

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U deepsave deepsave > backups/deepsave.sql
```

恢复备份（PostgreSQL）：

```bash
cat backups/deepsave.sql | docker compose exec -T db psql -U deepsave -d deepsave
```

## 浏览器插件（Chrome）
1. 打开 `chrome://extensions`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择仓库内 `extension/` 目录。
3. 在插件设置中配置：
  - API Base URL：`http://<host>:8356`
  - Access Token：在设置页生成的令牌
4. 使用方式：
  - Popup 点击保存当前页面
  - 右键菜单快速保存/记录

## 开发命令
### Docker 开发（推荐）
默认会挂载源码目录，支持热更新：

```bash
docker compose --profile cpu up
```

常用日志：

```bash
docker compose logs -f backend worker beat
```

### 前端独立开发

```bash
cd frontend
npm install
npm run dev
```

## 生产部署命令
建议禁用 override，使用纯净 Compose 文件：

```bash
docker compose -f docker-compose.yml --profile cpu up -d
```

GPU（启用 Ollama）：

```bash
docker compose -f docker-compose.yml --profile gpu up -d
```

升级/重建：

```bash
docker compose -f docker-compose.yml --profile cpu up -d --build
```

## 端口与服务
- 前端：`http://<host>:3000`
- 后端：`http://<host>:8356`
- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`
