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

export type AccessTokenResponse = {
  access_token: string;
};

export type AiSettingsResponse = {
  llm_base_url: string | null;
  llm_model: string | null;
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

export type ItemsOverview = {
  total_count: number;
  unread_count: number;
  processing_count: number;
  stale_count: number;
  today_count: number;
  latest_created_at: string | null;
  top_tags: TagCount[];
};
