export type ItemRecord = {
  id: string;
  url: string;
  normalized_url: string;
  title: string | null;
  summary: string | null;
  cached_tags: string | null;
  source_type: string;
  meta_json: Record<string, unknown>;
  processing_status: string;
  content_revision: number;
  analysis_revision: number;
  processing_target_revision?: number | null;
  content_format?: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  word_count?: number | null;
  char_count?: number | null;
  rrf_score?: number | null;
};

export type ItemDetail = ItemRecord & {
  content_text: string | null;
};

export type IngestResponse = {
  task_id: string;
  item_id: string;
  reused: boolean;
};

export type CreateNoteResponse = {
  item_id: string;
  task_id?: string | null;
  skipped: boolean;
};

export type AccessTokenResponse = {
  access_token: string;
};

export type AccessTokenItem = {
  id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type AccessTokenListResponse = {
  items: AccessTokenItem[];
};

export type AccessTokenRevokeResponse = {
  id: string;
  revoked: boolean;
};

export type AiSettingsResponse = {
  llm_base_url: string | null;
  llm_model: string | null;
  summary_system_prompt: string;
  summary_user_prompt_template: string;
  polish_system_prompt: string;
  polish_user_prompt_template: string;
  vision_user_prompt: string;
  embedding_base_url: string | null;
  embedding_model: string | null;
  embedding_dimensions: number | null;
  has_llm_api_key: boolean;
  has_embedding_api_key: boolean;
};

export type AiSettingsUpdate = {
  llm_api_key?: string | null;
  llm_base_url?: string | null;
  llm_model?: string | null;
  summary_system_prompt?: string | null;
  summary_user_prompt_template?: string | null;
  polish_system_prompt?: string | null;
  polish_user_prompt_template?: string | null;
  vision_user_prompt?: string | null;
  embedding_api_key?: string | null;
  embedding_base_url?: string | null;
  embedding_model?: string | null;
  embedding_dimensions?: number | null;
};

export type AiSettingsTestResponse = {
  llm_ok?: boolean | null;
  llm_error?: string | null;
  llm_latency_ms?: number | null;
  embedding_ok?: boolean | null;
  embedding_error?: string | null;
  embedding_latency_ms?: number | null;
};

export type AiSettingsTestRequest = {
  target: "all" | "llm" | "embedding";
  llm_api_key?: string | null;
  llm_base_url?: string | null;
  llm_model?: string | null;
  embedding_api_key?: string | null;
  embedding_base_url?: string | null;
  embedding_model?: string | null;
  embedding_dimensions?: number | null;
};

export type ItemsResponse = {
  items: ItemRecord[];
  next_cursor: string | null;
};

export type SearchResponse = {
  query: string;
  count: number;
  items: ItemRecord[];
};

export type TagCount = {
  tag: string;
  count: number;
};

export type TagTreeItem = {
  id: string;
  title: string | null;
  updated_at: string;
  is_read: boolean;
  source_type: string;
};

export type TagTreeNode = {
  id: number;
  name: string;
  path: string;
  depth: number;
  children: TagTreeNode[];
  items: TagTreeItem[];
};

export type TagGraphNode = {
  id: string;
  label: string;
  count: number;
  is_center: boolean;
};

export type TagGraphEdge = {
  source: string;
  target: string;
  co_count: number;
  weight: number;
};

export type TagGraphResponse = {
  center_tag: string;
  node_count: number;
  edge_count: number;
  nodes: TagGraphNode[];
  edges: TagGraphEdge[];
};

export type RelationGraphMode = "tag" | "item";

export type RelationGraphNode = {
  id: string;
  label: string;
  node_type: "tag" | "item";
  count: number;
};

export type RelationGraphEdge = {
  id: string;
  source: string;
  target: string;
  edge_type: "hierarchy" | "co_doc" | "shared_tag";
  shared_count: number;
};

export type RelationGraphResponse = {
  mode: RelationGraphMode;
  node_count: number;
  edge_count: number;
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
};

export type ItemsOverview = {
  total_count: number;
  unread_count: number;
  processing_count: number;
  stale_count: number;
  today_count: number;
  latest_created_at: string | null;
  top_tags: TagCount[];
};
