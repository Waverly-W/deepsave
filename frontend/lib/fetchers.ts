import { apiUrl } from "./api";
import { AUTH_UNAUTHORIZED_EVENT } from "./auth-events";
import type {
  AccessTokenListResponse,
  AccessTokenRevokeResponse,
  AccessTokenResponse,
  AiSettingsResponse,
  AiSettingsTestRequest,
  AiSettingsTestResponse,
  AiSettingsUpdate,
  CreateNoteResponse,
  IngestResponse,
  ItemDetail,
  ItemsResponse,
  ItemsOverview,
  RelationGraphMode,
  RelationGraphResponse,
  TagGraphResponse,
  SearchResponse,
  TagTreeNode
} from "./types";

type FetchOptions = {
  token?: string;
  keepalive?: boolean;
  signal?: AbortSignal;
};

export async function fetchItems(
  params: {
    cursor?: string | null;
    limit?: number;
    sourceType?: string | null;
    archived?: boolean;
  },
  options: FetchOptions = {}
): Promise<ItemsResponse> {
  const url = new URL(apiUrl("/items"));
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.sourceType) {
    url.searchParams.set("type", params.sourceType);
  }
  if (params.archived) {
    url.searchParams.set("archived", "true");
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load items");
  }
  return (await response.json()) as ItemsResponse;
}

export async function fetchSearch(
  params: {
    query: string;
    limit?: number;
    sourceType?: string | null;
  },
  options: FetchOptions = {}
): Promise<SearchResponse> {
  const url = new URL(apiUrl("/search"));
  url.searchParams.set("q", params.query);
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.sourceType) {
    url.searchParams.set("type", params.sourceType);
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load search results");
  }
  return (await response.json()) as SearchResponse;
}

export async function fetchItemsOverview(
  options: FetchOptions = {}
): Promise<ItemsOverview> {
  const response = await fetch(apiUrl("/items/overview"), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load items overview");
  }
  return (await response.json()) as ItemsOverview;
}

export async function fetchTagTree(
  options: FetchOptions = {},
  includeArchived = true
): Promise<{ tree: TagTreeNode[] }> {
  const url = new URL(apiUrl("/tags/tree"));
  if (!includeArchived) {
    url.searchParams.set("include_archived", "false");
  }
  const response = await fetch(url.toString(), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load tag tree");
  }
  return (await response.json()) as { tree: TagTreeNode[] };
}

export async function fetchTagGraph(
  params: {
    centerTag: string;
    maxNeighbors?: number;
    minWeight?: number;
    includeArchived?: boolean;
    days?: number | null;
  },
  options: FetchOptions = {}
): Promise<TagGraphResponse> {
  const url = new URL(apiUrl("/tags/graph"));
  url.searchParams.set("center_tag", params.centerTag);
  if (params.maxNeighbors !== undefined) {
    url.searchParams.set("max_neighbors", String(params.maxNeighbors));
  }
  if (params.minWeight !== undefined) {
    url.searchParams.set("min_weight", String(params.minWeight));
  }
  if (params.includeArchived !== undefined) {
    url.searchParams.set(
      "include_archived",
      params.includeArchived ? "true" : "false"
    );
  }
  if (params.days !== undefined && params.days !== null) {
    url.searchParams.set("days", String(params.days));
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load tag graph");
  }
  return (await response.json()) as TagGraphResponse;
}

export async function fetchRelationGraph(
  params: {
    mode: RelationGraphMode;
    includeArchived?: boolean;
    days?: number | null;
    maxNodes?: number;
    maxEdges?: number;
    minShared?: number;
  },
  options: FetchOptions = {}
): Promise<RelationGraphResponse> {
  const url = new URL(apiUrl("/tags/network"));
  url.searchParams.set("mode", params.mode);
  if (params.includeArchived !== undefined) {
    url.searchParams.set(
      "include_archived",
      params.includeArchived ? "true" : "false"
    );
  }
  if (params.days !== undefined && params.days !== null) {
    url.searchParams.set("days", String(params.days));
  }
  if (params.maxNodes !== undefined) {
    url.searchParams.set("max_nodes", String(params.maxNodes));
  }
  if (params.maxEdges !== undefined) {
    url.searchParams.set("max_edges", String(params.maxEdges));
  }
  if (params.minShared !== undefined) {
    url.searchParams.set("min_shared", String(params.minShared));
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load relation graph");
  }
  return (await response.json()) as RelationGraphResponse;
}

export async function fetchItemDetail(
  itemId: string,
  options: FetchOptions = {}
): Promise<ItemDetail> {
  const response = await fetch(apiUrl(`/items/${itemId}`), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load item");
  }
  return (await response.json()) as ItemDetail;
}

export async function updateItem(
  itemId: string,
  payload: {
    is_archived?: boolean;
    is_deleted?: boolean;
    is_read?: boolean;
    content_text?: string | null;
    content_format?: string | null;
    title?: string | null;
  },
  options: FetchOptions = {}
): Promise<ItemDetail> {
  const response = await fetch(apiUrl(`/items/${itemId}`), {
    method: "PATCH",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: options.keepalive ?? false
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to update item");
  }
  return (await response.json()) as ItemDetail;
}

export async function reprocessItemContent(
  itemId: string,
  options: FetchOptions = {}
): Promise<{ task_id: string; item_id: string }> {
  const response = await fetch(apiUrl(`/items/${itemId}/reprocess-content`), {
    method: "POST",
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to reprocess item content");
  }
  return (await response.json()) as { task_id: string; item_id: string };
}

export async function polishItemContent(
  itemId: string,
  options: FetchOptions = {}
): Promise<{ task_id: string; item_id: string }> {
  const response = await fetch(apiUrl(`/items/${itemId}/polish-content`), {
    method: "POST",
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to polish item content");
  }
  return (await response.json()) as { task_id: string; item_id: string };
}

export async function polishItemContentStream(
  itemId: string,
  options: FetchOptions = {}
): Promise<Response> {
  return fetch(apiUrl(`/items/${itemId}/polish-now`), {
    method: "POST",
    headers: authHeaders(options.token),
    cache: "no-store",
    signal: options.signal
  });
}

export async function requeueItem(
  itemId: string,
  options: FetchOptions = {}
): Promise<{ task_id: string; item_id: string }> {
  const response = await fetch(apiUrl(`/items/${itemId}/requeue`), {
    method: "POST",
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to requeue item");
  }
  return (await response.json()) as { task_id: string; item_id: string };
}

export async function ingestItem(
  payload: {
    url: string;
    sourceType?: string | null;
  },
  options: FetchOptions = {}
): Promise<IngestResponse> {
  const response = await fetch(apiUrl("/items/ingest"), {
    method: "POST",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: payload.url,
      source_type: payload.sourceType ?? undefined
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to ingest item");
  }
  return (await response.json()) as IngestResponse;
}

export async function createNote(
  payload: {
    title?: string | null;
    content_html: string;
    summary?: string | null;
    tags?: string[] | null;
    skip_queue?: boolean;
  },
  options: FetchOptions = {}
): Promise<CreateNoteResponse> {
  const response = await fetch(apiUrl("/items/create-note"), {
    method: "POST",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to create note");
  }
  return (await response.json()) as CreateNoteResponse;
}

export async function polishDraftStream(
  payload: {
    title?: string | null;
    content_html: string;
  },
  options: FetchOptions = {}
): Promise<Response> {
  return fetch(apiUrl("/items/polish-draft"), {
    method: "POST",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: options.signal
  });
}

export async function createAccessToken(
  payload: {
    label?: string;
  },
  options: FetchOptions = {}
): Promise<AccessTokenResponse> {
  const response = await fetch(apiUrl("/system/keys"), {
    method: "POST",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ label: payload.label ?? null }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to create access token");
  }
  return (await response.json()) as AccessTokenResponse;
}

export async function listAccessTokens(
  options: FetchOptions = {}
): Promise<AccessTokenListResponse> {
  const response = await fetch(apiUrl("/system/keys"), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load access tokens");
  }
  return (await response.json()) as AccessTokenListResponse;
}

export async function revokeAccessToken(
  keyId: string,
  options: FetchOptions = {}
): Promise<AccessTokenRevokeResponse> {
  const response = await fetch(apiUrl(`/system/keys/${keyId}`), {
    method: "DELETE",
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to revoke access token");
  }
  return (await response.json()) as AccessTokenRevokeResponse;
}

export async function fetchAiSettings(
  options: FetchOptions = {}
): Promise<AiSettingsResponse> {
  const response = await fetch(apiUrl("/system/ai-settings"), {
    headers: authHeaders(options.token),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to load AI settings");
  }
  return (await response.json()) as AiSettingsResponse;
}

export async function updateAiSettings(
  payload: AiSettingsUpdate,
  options: FetchOptions = {}
): Promise<AiSettingsResponse> {
  const response = await fetch(apiUrl("/system/ai-settings"), {
    method: "PUT",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to update AI settings");
  }
  return (await response.json()) as AiSettingsResponse;
}

export async function testAiSettings(
  payload: AiSettingsTestRequest,
  options: FetchOptions = {}
): Promise<AiSettingsTestResponse> {
  const response = await fetch(apiUrl("/system/ai-settings/test"), {
    method: "POST",
    headers: {
      ...authHeaders(options.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    throw buildApiError(response, "Failed to test AI settings");
  }
  return (await response.json()) as AiSettingsTestResponse;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildApiError(response: Response, fallbackMessage: string): ApiError {
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
  return new ApiError(fallbackMessage, response.status);
}

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
