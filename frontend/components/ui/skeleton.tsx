import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/80 motion-reduce:animate-none dark:bg-neutral-800/70 ${className}`}
      {...props}
    />
  );
}
