## Context

DeepSave 当前已经具备本地优先知识库的主体能力：FastAPI backend、Celery worker、Redis、Postgres/pgvector、Next.js frontend、Chrome extension，以及 `/items/ingest` URL 入库接口。现有 ingest schema 为 `url/source_type/content_text/title`，worker 会根据 `source_type` 处理 note、image 或普通网页。

Hermes 的 `web-clipper` skill 当前更像一个独立剪藏器：访问 URL、抽取正文/元信息/图片、可做视觉分析和相关链接递归，然后写入 `~/.hermes/workspace/collections/`。这与 DeepSave 的长期定位冲突：内容被保存到 Markdown 文件后无法进入 DeepSave 的去重、队列、摘要、标签、向量化、搜索、时间线和编辑流程。

当前 DeepSave 一个关键约束是：`IngestService.ingest()` 使用 `resolved_override = source_type or ("note" if note_text else None)`，导致只要调用方传入 `content_text` 且未显式覆盖，就会倾向 note 语义。与 web-clipper 联动时，这会把“外部已抽取的文章正文”误当作用户 note。

## Goals / Non-Goals

**Goals:**

- 将 DeepSave 确立为唯一主知识库，Hermes web-clipper 作为采集前端。
- 保留 URL-only ingest 的简单路径，普通网页优先让 DeepSave 后端抓取和处理。
- 支持 provided content 路径：Hermes/browser 已抽取正文时，可以传给 DeepSave，DeepSave 可跳过抓取并继续 AI 分析。
- 保存 clipper 来源 metadata，便于调试、前端展示和后续扩展。
- 将 related links 默认记录为 metadata，不默认批量入库。
- DeepSave 不可用时，web-clipper 仍可 fallback 写本地 Markdown，避免剪藏丢失。

**Non-Goals:**

- 不在第一阶段实现完整离线网页归档、MHTML、截图、图片二进制入库或 artifact store。
- 不在第一阶段让 web-clipper 负责标签体系、向量化、搜索索引或任务状态管理。
- 不要求立即重写 Chrome extension；但后续可复用同一 clipper API。
- 不默认递归保存所有相关链接。
- 不让外部 summary/tags 默认覆盖 DeepSave 的 AI 分析结果；第一阶段只作为 hint 或 metadata。

## Decisions

### Decision 1: DeepSave-first, collections fallback

`web-clipper` 的默认保存目标改为 DeepSave API。只有在 DeepSave API 不可用、鉴权失败、网络失败，或用户明确要求保存 Markdown 文件时，才写入 `collections/`。

**Rationale:** DeepSave 有去重、任务、状态、AI 处理、检索和编辑能力；Markdown 文件适合作为备份，不适合作为长期主存储。

**Alternative considered:** 继续同时写 DeepSave 和 Markdown 双份。该方案增加一致性问题，容易出现同一篇文章多个来源版本，暂不作为默认。

### Decision 2: `content_text` is not `note`

`content_text` 只表示“调用方提供了内容”。是否是 note 必须由 `source_type=note` 或专门 note API 明确表达。`source_type=article + content_text` 表示“外部已抽取的文章”。

**Rationale:** 这是 web-clipper 与 DeepSave 联动的核心语义修正。否则文章正文一旦由 Hermes 传入，就会污染 note 类型、过滤、统计和阅读体验。

**Alternative considered:** 新增 `article_text` 字段而不改变 `content_text`。这会增加 API 字段重复，且不能解决旧字段语义混乱。

### Decision 3: Two ingest modes before dedicated `/items/clip`

第一阶段继续扩展 `/items/ingest`：

- URL-only:
  ```json
  {"url": "https://example.com/a", "source_type": "article"}
  ```
- Provided content:
  ```json
  {
    "url": "https://example.com/a",
    "source_type": "article",
    "title": "...",
    "content_text": "...",
    "content_format": "markdown",
    "skip_fetch": true,
    "source_app": "hermes-web-clipper",
    "meta_json": {"ingest": {"method": "browser_snapshot"}}
  }
  ```

后续再新增专用 `/items/clip`，承接复杂 payload。

**Rationale:** 复用现有 API 可快速打通 MVP；专用 API 等 payload 稳定后再做，避免过早设计。

**Alternative considered:** 立即新增 `/items/clip`。长期更干净，但第一步改动更大，也需要同步 extension 和前端。

### Decision 4: Metadata lives in `Item.meta_json`

外部剪藏 metadata 统一写入 `items.meta_json`，建议结构：

```json
{
  "ingest": {
    "source_app": "hermes-web-clipper",
    "source_channel": "cli|telegram|webui|browser",
    "captured_at": "2026-04-27T...Z",
    "method": "url_only|provided_content|browser_snapshot",
    "clipper_version": "2.1",
    "skip_fetch": true
  },
  "source": {
    "author": "...",
    "site_name": "...",
    "published_at": "...",
    "language": "zh"
  },
  "images": [
    {"url": "...", "alt": "...", "caption": "...", "vision_text": "..."}
  ],
  "related_links": [
    {"url": "...", "text": "...", "reason": "正文引用"}
  ]
}
```

`ItemRepository.upsert()` 对 metadata 应尽量 merge，而不是无条件覆盖已有 metadata。

**Rationale:** 避免为早期 clipper metadata 过早加表，同时保留足够可观察性。

### Decision 5: Normalize provided content at the boundary

新增或提取统一内容规范化逻辑：

```python
normalize_provided_content(content: str, format: str) -> tuple[str, str]
```

- `format=markdown`: markdown 转 HTML，再提取 plain text。
- `format=html`: 清洗/保留安全 HTML，再提取 plain text。
- `format=text`: escape + paragraphize，再提取 plain text。

DeepSave 主内容仍保存为 `content_format=html`，与当前 minimal-tiptap 编辑器一致。

**Rationale:** 前端编辑器和现有迁移已经统一到 HTML，外部内容必须在入库或处理前规范化。

### Decision 6: Worker skips fetch only when explicitly requested

worker 对普通文章默认仍抓取 URL。只有满足以下条件时跳过抓取：

- `item.source_type == "article"` 或其他非 note/image 文本类型；
- `item.content_text` 非空；
- `meta_json.ingest.skip_fetch == true` 或 ingest payload 显式 `skip_fetch=true` 已持久化；
- `content_format=html` 或已被规范化为 HTML。

**Rationale:** 默认抓取保持现有行为；显式 skip_fetch 只用于外部已抽取内容可信的情况。

### Decision 7: Related links are metadata by default

web-clipper 提取 related links 后，默认写入 `meta_json.related_links`。除非用户明确要求“相关链接也保存”，否则不批量提交 DeepSave。

**Rationale:** 递归保存容易污染知识库和制造重复任务。让 DeepSave UI 提供“一键保存相关链接”会更可控。

### Decision 8: Response includes a user-facing link contract

`/items/ingest` 响应扩展为：

```python
class IngestResponse(BaseModel):
    task_id: str | None
    item_id: str
    reused: bool = False
    status: str | None = None
    detail_url: str | None = None
```

**Rationale:** Hermes web-clipper 可以直接给用户明确反馈：已保存、处理中、是否复用、打开链接。

## Risks / Trade-offs

- [Risk] `content_text` 语义变化影响旧调用方 → Mitigation: 明确兼容策略；Chrome extension 的“选中文本保存为 note”必须显式传 `source_type=note` 或改用 note API。
- [Risk] 外部 HTML 注入不安全 → Mitigation: 所有 `content_format=html` 的 provided content 必须清洗，前端渲染继续使用安全策略。
- [Risk] metadata merge 策略不当覆盖旧信息 → Mitigation: `meta_json.ingest` 使用命名空间；upsert 对 dict 做浅/深 merge，并保留已有字段。
- [Risk] worker provided-content 路径与现有文章抓取路径重复代码 → Mitigation: 提取 shared 文本分析函数，避免 note/article/image 三个分支继续膨胀。
- [Risk] URL-only ingest 对登录态/动态页面仍失败 → Mitigation: web-clipper 可在失败后走 provided-content 二次提交，或用户显式要求浏览器快照模式。
- [Risk] 第一阶段没有 artifact store，无法完整归档原始网页 → Mitigation: 把 snapshot/archive 放入后续 `/items/clip` Phase 3。

## Migration Plan

1. 安装并初始化 OpenSpec，记录本设计和 specs。
2. Phase 1：web-clipper 只调用 DeepSave URL-only ingest，失败 fallback collections；DeepSave 后端可不改或少量扩展响应。
3. Phase 2：扩展 `/items/ingest` schema、service、repository、worker，支持 provided content 与 metadata。
4. Phase 2.5：前端详情 metadata card 展示来源和相关链接摘要。
5. Phase 3：新增 `/items/clip` 专用 API，逐步让 Chrome extension 和 Hermes skill 统一接入。
6. Rollback：web-clipper 可关闭 DeepSave 模式回到 collections fallback；DeepSave 保留 URL-only ingest 兼容路径。

## Open Questions

- DeepSave frontend 的本地访问地址应由后端配置生成 `detail_url`，还是由 web-clipper 根据已知 frontend URL 拼接？
- `meta_json` merge 采用数据库 JSONB merge，还是 Python 层读取后 deep merge？
- Provided content 的可信等级如何标记？是否需要保留原始外部正文与 DeepSave polish 后正文的差异？
- `/items/clip` 是否应该支持 artifacts 二进制上传，还是只引用外部路径/URL？
