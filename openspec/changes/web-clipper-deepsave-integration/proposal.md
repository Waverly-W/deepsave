## Why

Hermes 的 `web-clipper` skill 当前会把剪藏结果写入本地 `collections/` Markdown 文件，形成独立于 DeepSave 的存储孤岛；DeepSave 已经具备 URL ingest、抓取、AI 摘要、标签、向量化、搜索、时间线和编辑能力，应该成为统一知识库后端。

本变更将 `web-clipper` 定位为“智能采集前端/预处理器”，将 DeepSave 定位为“知识库后端/索引与管理系统”，使 Hermes、浏览器插件、Telegram/CLI/WebUI 链接剪藏都能进入同一套 DeepSave 入库、去重、处理和检索流程。

## What Changes

- DeepSave 新增/强化外部 clipper ingest 能力，允许调用方传入 URL-only、已抽取正文、采集元信息、图片/相关链接等结构化信息。
- DeepSave 修正 `content_text` 的语义：`content_text` 只表示“调用方提供了内容”，不再自动等同于 `note`；真正类型由 `source_type` 决定。
- DeepSave 支持 `article + provided content + skip_fetch` 路径：当 Hermes 已经抽取正文时，worker 可跳过网页抓取，直接进行摘要、标签、向量化等 AI 处理。
- DeepSave 保存外部来源元信息，例如 `source_app=hermes-web-clipper`、采集方式、图片列表、相关链接、原始发布时间、作者等。
- DeepSave 响应里返回更适合剪藏前端展示的信息，例如 `item_id`、`task_id`、`reused`、状态和详情页 URL。
- `web-clipper` skill 改为优先调用 DeepSave API 保存；DeepSave 不可用时才 fallback 到本地 `collections/` Markdown。
- `web-clipper` 默认只保存主 URL；相关链接默认作为 metadata 记录，不自动递归保存，避免污染知识库。
- 未来可新增专用 `/items/clip` API，承接更完整的剪藏 payload，包括正文、元信息、图片、视觉描述、相关链接、截图/HTML 快照和处理选项。
- **BREAKING**: 对使用 DeepSave `/items/ingest` 的调用方而言，传入 `content_text` 不再隐式创建 note；如果要创建 note，必须显式设置 `source_type=note` 或使用已有 note 创建接口。

## Capabilities

### New Capabilities

- `clipper-ingestion`: 外部剪藏客户端（Hermes web-clipper、Chrome extension、Telegram/CLI/WebUI 自动剪藏）可把 URL、已抽取正文和采集元信息提交给 DeepSave，并获得统一入库、任务和详情页回链。
- `provided-content-processing`: DeepSave worker 可处理外部调用方已提供的文章正文，支持跳过抓取但继续执行清洗、摘要、标签、向量化和状态更新。
- `clipper-source-metadata`: DeepSave 可保存和展示剪藏来源、采集方式、图片、相关链接、作者、发布时间等结构化元信息。

### Modified Capabilities

- 当前项目尚无 OpenSpec 基线 spec；无需修改既有 OpenSpec capability。

## Impact

- Backend API:
  - `backend/app/schemas/items.py` 的 `IngestRequest` / `IngestResponse`。
  - `backend/app/api/items.py` 的 `/items/ingest` 参数传递和响应构造。
- Backend services:
  - `backend/app/services/ingest_service.py` 的 `source_type` 推断、内容规范化、metadata 传递和入库逻辑。
  - `backend/app/repositories/item_repo.py` 的 `upsert()` 参数，尤其是 `meta_json`、`content_format`、内容修订和 pending 状态处理。
- Worker pipeline:
  - `backend/app/worker/tasks.py` 的文章分支需支持 `skip_fetch/provided_content`。
  - 可能新增内容规范化工具，例如 `backend/app/utils/content_normalization.py`。
- Frontend:
  - 详情页 metadata card 展示 `meta_json.ingest`、图片数量、相关链接数量等信息。
- Hermes skill:
  - `web-clipper` skill 文档和执行逻辑改为 DeepSave-first，collections fallback。
- Runtime/config:
  - 需要 DeepSave API base URL 和 Access Token 配置，例如 `DEEPSAVE_API_BASE`、`DEEPSAVE_ACCESS_TOKEN`。
- Product behavior:
  - DeepSave 成为默认知识库；`collections/` 仅作为离线备份、fallback 或显式 Markdown 导出目标。
