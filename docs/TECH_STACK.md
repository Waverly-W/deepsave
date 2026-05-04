# DeepSave Pro 技术栈（TECH_STACK）

> **严格锁定**：本文件为技术栈唯一权威来源，修改需同步更新相关文档与实现。

## 1. 前端
- Framework：Next.js 14+（App Router）
- Language：TypeScript 5.x
- Styling：Tailwind CSS 3.x（`darkMode: 'class'`）
- UI：shadcn/ui（Radix UI）
- State：Zustand（全局）、TanStack Query v5（API）
- Forms：React Hook Form + Zod
- Auth：NextAuth.js（Credentials Provider）

## 2. 后端
- Language：Python 3.11+
- Web：FastAPI（Async）
- Task Queue：Celery 5.x
- Broker：Redis 7.x
- ORM：SQLAlchemy 2.x（Async）
- Migrations：Alembic（Mandatory）

## 3. 数据存储与检索
- Database：PostgreSQL 16（pgvector/pg_trgm）
- Vector：pgvector（HNSW 索引）
- FTS：Postgres + jieba 分词 + tsvector
- Artifacts：NAS 文件系统（/data/artifacts/...）

## 4. AI 与处理
- LLM 接口：OpenAI Compatible SDK（支持 DeepSeek/Moonshot 等）
- Embedding：
  - Local：BAAI/bge-m3（sentence-transformers）
  - Cloud：Aliyun text-embedding-v4（dimensions=1024，Key=ALIYUN_API_KEY）
- Vision：MiniCPM-V 或兼容的云端 Vision API

## 5. 采集与解析
- Primary：trafilatura
- Browser fallback：不启用（为降低 NAS 镜像体积与运行资源占用，复杂动态网页可能抓取不完整）
- 中文分词：jieba
- 色板提取：colorgram.py

## 6. 工具与脚本
- clipboard_monitor.py：pyperclip + requests

## 7. 安全
- 密码哈希：bcrypt（cost=12）
- JWT：HS256（24h 过期）
- API Key：AES-GCM（APP_SECRET_KEY）
- Access Token：随机 32 字符十六进制，DB 存 SHA-256
