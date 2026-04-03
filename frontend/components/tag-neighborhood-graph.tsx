"use client";

import { useQuery } from "@tanstack/react-query";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import cola from "cytoscape-cola";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { fetchTagGraph } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";
import type { TagGraphEdge, TagGraphNode } from "../lib/types";

type TagNeighborhoodGraphProps = {
  centerTag: string | null;
  className?: string;
};

const MAX_NEIGHBORS = 12;
const MIN_WEIGHT = 0.1;
const GRAPH_HEIGHT = 260;

cytoscape.use(cola);

const cyStyles: any[] = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      label: "data(label)",
      color: "#374151",
      "font-size": "11px",
      "font-weight": 500,
      "text-wrap": "ellipsis",
      "text-max-width": 92,
      "text-valign": "bottom",
      "text-margin-y": 7,
      "text-halign": "center",
      "border-width": 1.5,
      "border-color": "#ffffff"
    }
  },
  {
    selector: 'node[isCenter = "true"]',
    style: {
      "border-width": 2.5
    }
  },
  {
    selector: "edge",
    style: {
      width: "data(lineWidth)",
      "line-color": "#34d399",
      opacity: "data(lineOpacity)",
      "curve-style": "bezier"
    }
  },
  {
    selector: ".faded",
    style: {
      opacity: 0.12
    }
  },
  {
    selector: ".active",
    style: {
      opacity: 1
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

function buildElements(nodes: TagGraphNode[], edges: TagGraphEdge[]): ElementDefinition[] {
  const counts = nodes.map((node) => node.count);
  const minCount = counts.length ? Math.min(...counts) : 0;
  const maxCount = counts.length ? Math.max(...counts) : 0;

  const weights = edges.map((edge) => edge.weight);
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 1;

  const nodeElements: ElementDefinition[] = nodes.map((node) => {
    const size = scaleLinear(node.count, minCount, maxCount, 18, 34);
    return {
      data: {
        id: node.id,
        label: node.label,
        count: node.count,
        isCenter: node.is_center,
        size,
        color: node.is_center ? "#10b981" : "#0ea5e9"
      }
    };
  });

  const edgeElements: ElementDefinition[] = edges.map((edge) => {
    const lineWidth = scaleLinear(edge.weight, minWeight, maxWeight, 1.2, 4);
    const lineOpacity = scaleLinear(edge.weight, minWeight, maxWeight, 0.18, 0.78);
    return {
      data: {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        coCount: edge.co_count,
        lineWidth,
        lineOpacity
      }
    };
  });

  return [...nodeElements, ...edgeElements];
}

export default function TagNeighborhoodGraph({
  centerTag,
  className
}: TagNeighborhoodGraphProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t } = useI18n();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  const normalizedCenterTag = centerTag?.trim() ?? "";

  const graphQuery = useQuery({
    queryKey: [
      "tag-graph",
      normalizedCenterTag,
      {
        maxNeighbors: MAX_NEIGHBORS,
        minWeight: MIN_WEIGHT,
        includeArchived: false
      }
    ],
    enabled: Boolean(token) && Boolean(normalizedCenterTag),
    staleTime: 30000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      fetchTagGraph(
        {
          centerTag: normalizedCenterTag,
          maxNeighbors: MAX_NEIGHBORS,
          minWeight: MIN_WEIGHT,
          includeArchived: false
        },
        { token }
      )
  });

  const nodes = useMemo(() => graphQuery.data?.nodes ?? [], [graphQuery.data?.nodes]);
  const edges = useMemo(() => graphQuery.data?.edges ?? [], [graphQuery.data?.edges]);
  const hasGraph = edges.length > 0 && nodes.length > 1;

  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges]);

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
      wheelSensitivity: 0.2,
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
      const label = event.target.data("label") as string | undefined;
      if (!label) {
        return;
      }
      const command = `/tag ${label}`;
      router.push(`/timeline?q=${encodeURIComponent(command)}`);
    };

    cy.on("mouseover", "node", onMouseOverNode);
    cy.on("mouseout", "node", onMouseOutNode);
    cy.on("tap", "node", onTapNode);

    cy
      .layout({
        name: "cola",
        animate: true,
        randomize: false,
        avoidOverlap: true,
        fit: true,
        padding: 20,
        maxSimulationTime: 1800,
        nodeSpacing: 14,
        edgeLength: 80
      } as any)
      .run();

    return () => {
      cy.off("mouseover", "node", onMouseOverNode);
      cy.off("mouseout", "node", onMouseOutNode);
      cy.off("tap", "node", onTapNode);
      cy.destroy();
      if (cyRef.current === cy) {
        cyRef.current = null;
      }
    };
  }, [elements, hasGraph, router]);

  if (!normalizedCenterTag) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("detail.tagGraphNoTags")}
      </p>
    );
  }

  if (graphQuery.isLoading) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("detail.tagGraphLoading")}
      </p>
    );
  }

  if (graphQuery.isError) {
    return (
      <p className="text-sm text-rose-600 dark:text-rose-300">
        {t("detail.tagGraphError")}
      </p>
    );
  }

  if (!hasGraph) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("detail.tagGraphEmpty")}
      </p>
    );
  }

  return (
    <div className={className ?? ""}>
      <div
        ref={containerRef}
        style={{ height: GRAPH_HEIGHT }}
        className="w-full rounded-2xl border border-neutral-200/70 bg-white/70 dark:border-neutral-800/60 dark:bg-neutral-900/40"
      />
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t("detail.tagGraphHint")}
      </p>
    </div>
  );
}
