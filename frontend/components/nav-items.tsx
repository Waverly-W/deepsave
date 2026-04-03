"use client";

import type { ComponentType } from "react";
import { Clock, Home, Network, Settings, Tags } from "lucide-react";

export type NavItem = {
  href: string;
  labelKey:
    | "common.home"
    | "common.timeline"
    | "common.tags"
    | "common.graph"
    | "common.settings";
  icon: ComponentType<{ className?: string }>;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "common.home", icon: Home },
  { href: "/timeline", labelKey: "common.timeline", icon: Clock },
  { href: "/tags", labelKey: "common.tags", icon: Tags },
  { href: "/graph", labelKey: "common.graph", icon: Network },
  { href: "/settings", labelKey: "common.settings", icon: Settings }
];
