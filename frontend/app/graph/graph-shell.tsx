"use client";

import { useQuery } from "@tanstack/react-query";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import cola from "cytoscape-cola";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import BottomTabBar from "../../components/bottom-tab-bar";
import Sidebar from "../../components/sidebar";
import { fetchRelationGraph } from "../../lib/fetchers";
import { useI18n } from "../../lib/i18n-provider";
import type {
  RelationGraphEdge,
  RelationGraphMode,
  RelationGraphNode
} from "../../lib/types";

cytoscape.use(cola);

const TAG_MAX_NODES = 480;
const TAG_MAX_EDGES = 2200;
const ITEM_MAX_NODES = 280;
const ITEM_MAX_EDGES = 2000;
const GRAPH_HEIGHT = "min(74vh, 860px)";
const TAG_NODE_MIN_SIZE = 9;
const TAG_NODE_MAX_SIZE = 22;
const ITEM_NODE_MIN_SIZE = 10;
const ITEM_NODE_MAX_SIZE = 24;
const TAG_ALWAYS_LABEL_MAX = 90;
const ITEM_ALWAYS_LABEL_MAX = 70;

const cyStyles: any[] = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      label: "data(label)",
      color: "#334155",
      "font-size": "10px",
      "font-weight": 500,
      "text-wrap": "ellipsis",
      "text-max-width": 110,
      "text-valign": "bottom",
      "text-margin-y": 6,
      "text-halign": "center",
      "text-opacity": "data(labelOpacity)",
      "text-background-color": "rgba(248,250,252,0.84)",
      "text-background-opacity": 1,
      "text-background-padding": "2px",
      "text-background-shape": "roundrectangle",
      "border-width": 1.2,
      "border-color": "#ffffff",
      "overlay-padding": 5,
      "z-index": 5
    }
  },
  {
    selector: 'node[nodeType = "tag"]',
    style: {
      "background-color": "#0ea5e9",
      shape: "ellipse"
    }
  },
  {
    selector: 'node[nodeType = "item"]',
    style: {
      "background-color": "#10b981",
      shape: "round-rectangle"
    }
  },
  {
    selector: "edge",
    style: {
      width: "data(lineWidth)",
      "line-color": "#94a3b8",
      opacity: "data(lineOpacity)",
      "curve-style": "bezier",
      "line-cap": "round"
    }
  },
  {
    selector: 'edge[edgeType = "hierarchy"]',
    style: {
      "line-color": "#94a3b8",
      "line-style": "dashed",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#94a3b8",
      "arrow-scale": 0.8
    }
  },
  {
    selector: 'edge[edgeType = "co_doc"]',
    style: {
      "line-color": "#22c55e"
    }
  },
  {
    selector: 'edge[edgeType = "shared_tag"]',
    style: {
      "line-color": "#0ea5e9"
    }
  },
  {
    selector: ".faded",
    style: {
      opacity: 0.08
    }
  },
  {
    selector: ".active",
    style: {
      opacity: 1,
      "text-opacity": 1,
      "z-index": 10
    }
  }
];

function scaleLinear(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax <= inMin) {
    return (outMin + outMax) / 2;
  }
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

function truncate(text: string, max = 22): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(1, q));
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * clamped));
  return sorted[index] ?? 0;
}

function toElements(
  nodes: RelationGraphNode[],
  edges: RelationGraphEdge[],
  mode: RelationGraphMode
): ElementDefinition[] {
  const counts = nodes.map((node) => node.count ?? 0);
  const minCount = counts.length ? Math.min(...counts) : 0;
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const nodeLabelCutoff = percentile(counts, 0.68);
  const alwaysShowLabelCount =
    mode === "tag" ? TAG_ALWAYS_LABEL_MAX : ITEM_ALWAYS_LABEL_MAX;
  const shouldAlwaysShowLabels = nodes.length <= alwaysShowLabelCount;

  const sharedCounts = edges.map((edge) => edge.shared_count ?? 1);
  const minShared = sharedCounts.length ? Math.min(...sharedCounts) : 1;
  const maxShared = sharedCounts.length ? Math.max(...sharedCounts) : 1;

  const nodeElements: ElementDefinition[] = nodes.map((node) => {
    const size = scaleLinear(
      node.count ?? 0,
      minCount,
      maxCount,
      mode === "tag" ? TAG_NODE_MIN_SIZE : ITEM_NODE_MIN_SIZE,
      mode === "tag" ? TAG_NODE_MAX_SIZE : ITEM_NODE_MAX_SIZE
    );
    const displayLabel = mode === "item" ? truncate(node.label, 26) : truncate(node.label, 20);
    const labelOpacity =
      shouldAlwaysShowLabels || (node.count ?? 0) >= nodeLabelCutoff ? 1 : 0;
    return {
      data: {
        id: node.id,
        label: displayLabel,
        rawLabel: node.label,
        size,
        count: node.count,
        nodeType: node.node_type,
        labelOpacity
      }
    };
  });

  const edgeElements: ElementDefinition[] = edges.map((edge) => {
    const lineWidth = scaleLinear(edge.shared_count ?? 1, minShared, maxShared, 1, 4.6);
    const lineOpacity = scaleLinear(edge.shared_count ?? 1, minShared, maxShared, 0.18, 0.82);
    const baseLength = mode === "tag" ? 320 : 360;
    const shrink = scaleLinear(edge.shared_count ?? 1, minShared, maxShared, 0, 140);
    const idealLength =
      edge.edge_type === "hierarchy" ? 300 : Math.max(mode === "tag" ? 170 : 210, baseLength - shrink);
    return {
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edge_type,
        sharedCount: edge.shared_count,
        lineWidth,
        lineOpacity,
        idealLength
      }
    };
  });

  return [...nodeElements, ...edgeElements];
}

function distributeDisconnectedComponents(cy: Core) {
  const components = cy
    .elements()
    .components()
    .filter((component) => component.nodes().length > 0);

  if (components.length <= 1) {
    return;
  }

  const ranked = [...components].sort((a, b) => b.nodes().length - a.nodes().length);
  const boxes = ranked.map((component) => {
    const bb = component.boundingBox();
    return {
      component,
      width: Math.max(bb.w, 110),
      height: Math.max(bb.h, 90)
    };
  });

  const maxWidth = Math.max(...boxes.map((item) => item.width), 420);
  const maxHeight = Math.max(...boxes.map((item) => item.height), 300);
  const gapX = 150;
  const gapY = 130;
  const cellWidth = maxWidth + gapX;
  const cellHeight = maxHeight + gapY;
  const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length * 1.6)));
  const rows = Math.max(1, Math.ceil(boxes.length / cols));
  const totalWidth = cols * cellWidth;
  const totalHeight = rows * cellHeight;
  const startX = -totalWidth / 2 + cellWidth / 2;
  const startY = -totalHeight / 2 + cellHeight / 2;

  cy.batch(() => {
    boxes.forEach((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const serpentineCol = row % 2 === 0 ? col : cols - col - 1;
      const targetCenterX = startX + serpentineCol * cellWidth;
      const targetCenterY = startY + row * cellHeight;
      const bb = item.component.boundingBox();
      const currentCenterX = (bb.x1 + bb.x2) / 2;
      const currentCenterY = (bb.y1 + bb.y2) / 2;
      const dx = targetCenterX - currentCenterX;
      const dy = targetCenterY - currentCenterY;

      item.component.nodes().forEach((node) => {
        const position = node.position();
        node.position({
          x: position.x + dx,
          y: position.y + dy
        });
      });
    });
  });
}

export default function GraphShell() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const router = useRouter();
  const { t, locale } = useI18n();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [mode, setMode] = useState<RelationGraphMode>("tag");

  const graphQuery = useQuery({
    queryKey: ["relation-graph", mode],
    enabled: Boolean(token),
    staleTime: 30000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      fetchRelationGraph(
        {
          mode,
          includeArchived: false,
          maxNodes: mode === "tag" ? TAG_MAX_NODES : ITEM_MAX_NODES,
          maxEdges: mode === "tag" ? TAG_MAX_EDGES : ITEM_MAX_EDGES,
          minShared: 1
        },
        { token }
      )
  });

  const nodes = useMemo(() => graphQuery.data?.nodes ?? [], [graphQuery.data?.nodes]);
  const edges = useMemo(() => graphQuery.data?.edges ?? [], [graphQuery.data?.edges]);
  const hasGraph = nodes.length > 0;
  const elements = useMemo(() => toElements(nodes, edges, mode), [nodes, edges, mode]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!hasGraph) {
      cyRef.current?.destroy();
      cyRef.current = null;
      return;
    }

    cyRef.current?.destroy();

    const cy = cytoscape({
      container,
      elements,
      wheelSensitivity: 0.24,
      boxSelectionEnabled: false,
      autounselectify: true,
      style: cyStyles
    });
    cyRef.current = cy;

    const resetHighlight = () => {
      cy.elements().removeClass("faded").removeClass("active");
    };

    const applyHighlight = (nodeId: string) => {
      const node = cy.getElementById(nodeId);
      if (!node.nonempty()) {
        return;
      }
      const neighborhood = node.closedNeighborhood();
      cy.elements().addClass("faded").removeClass("active");
      neighborhood.removeClass("faded").addClass("active");
    };

    const onMouseOverNode = (event: cytoscape.EventObjectNode) => {
      applyHighlight(event.target.id());
    };

    const onMouseOutNode = () => {
      resetHighlight();
    };

    const onTapNode = (event: cytoscape.EventObjectNode) => {
      const nodeId = event.target.id();
      const rawLabel = event.target.data("rawLabel") as string | undefined;
      if (!rawLabel) {
        return;
      }

      if (mode === "tag") {
        const command = `/tag ${rawLabel}`;
        router.push(`/timeline?q=${encodeURIComponent(command)}`);
        return;
      }

      if (nodeId.startsWith("item:")) {
        const itemId = nodeId.slice(5);
        if (itemId) {
          router.push(`/tags?itemId=${encodeURIComponent(itemId)}`);
        }
      }
    };

    cy.on("mouseover", "node", onMouseOverNode);
    cy.on("mouseout", "node", onMouseOutNode);
    cy.on("tap", "node", onTapNode);

    const layout = cy.layout({
      name: "cola",
      animate: true,
      refresh: 2,
      randomize: true,
      avoidOverlap: true,
      fit: false,
      padding: 32,
      handleDisconnected: false,
      centerGraph: false,
      nodeDimensionsIncludeLabels: true,
      maxSimulationTime: 4200,
      convergenceThreshold: 0.015,
      nodeSpacing: (node: any) => {
        const size = Number(node.data("size") ?? 12);
        return mode === "tag" ? size * 1.15 + 18 : size * 1.3 + 22;
      },
      edgeLength: (edge: any) => Number(edge.data("idealLength") ?? 180)
    } as any);

    const onLayoutStop = () => {
      distributeDisconnectedComponents(cy);
      cy.fit(cy.elements(), 62);
    };

    (layout as any).on("layoutstop", onLayoutStop);
    layout.run();

    return () => {
      (layout as any).off("layoutstop", onLayoutStop);
      cy.off("mouseover", "node", onMouseOverNode);
      cy.off("mouseout", "node", onMouseOutNode);
      cy.off("tap", "node", onTapNode);
      cy.destroy();
      if (cyRef.current === cy) {
        cyRef.current = null;
      }
    };
  }, [elements, hasGraph, mode, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_85%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_85%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <Sidebar />
      <BottomTabBar />

      <div className="relative mx-auto min-h-screen w-full max-w-7xl px-6 pt-10 pb-[calc(2.5rem+var(--bottom-tab-height)+env(safe-area-inset-bottom))] md:py-10 md:pl-20">
        <section className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
              {t("common.graph")}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{t("graph.heading")}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{t("graph.subtitle")}</p>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-neutral-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <div className="inline-flex rounded-2xl border border-neutral-200/70 bg-white/80 p-1 dark:border-neutral-800 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => setMode("tag")}
                className={`rounded-xl px-3 py-1.5 text-sm transition ${
                  mode === "tag"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                }`}
              >
                {t("graph.mode.tag")}
              </button>
              <button
                type="button"
                onClick={() => setMode("item")}
                className={`rounded-xl px-3 py-1.5 text-sm transition ${
                  mode === "item"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                }`}
              >
                {t("graph.mode.item")}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="rounded-full border border-neutral-200/70 px-2.5 py-1 dark:border-neutral-800/60">
                nodes: {numberFormatter.format(nodes.length)}
              </span>
              <span className="rounded-full border border-neutral-200/70 px-2.5 py-1 dark:border-neutral-800/60">
                edges: {numberFormatter.format(edges.length)}
              </span>
            </div>
          </div>

          <section className="rounded-3xl border border-neutral-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            {graphQuery.isLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("graph.loading")}</p>
            ) : null}

            {graphQuery.isError ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">{t("graph.error")}</p>
            ) : null}

            {!graphQuery.isLoading && !graphQuery.isError && !hasGraph ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("graph.empty")}</p>
            ) : null}

            {!graphQuery.isLoading && !graphQuery.isError && hasGraph ? (
              <>
                <div
                  ref={containerRef}
                  style={{ height: GRAPH_HEIGHT }}
                  className="w-full rounded-2xl border border-neutral-200/70 bg-white/70 dark:border-neutral-800/60 dark:bg-neutral-950/40"
                />
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {mode === "tag" ? t("graph.hint.tag") : t("graph.hint.item")}
                </p>
              </>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
