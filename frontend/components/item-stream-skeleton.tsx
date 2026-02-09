"use client";

type BlockProps = {
  className?: string;
};

type ItemStreamSkeletonProps = {
  view: "chat" | "gallery";
  count?: number;
};

function Block({ className = "" }: BlockProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/80 motion-reduce:animate-none dark:bg-neutral-800/70 ${className}`}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
      <div className="flex items-center justify-between">
        <Block className="h-5 w-24" />
        <Block className="h-5 w-16" />
      </div>
      <Block className="mt-4 h-6 w-3/4" />
      <Block className="mt-3 h-4 w-full" />
      <Block className="mt-2 h-4 w-5/6" />
      <div className="mt-4 flex items-center justify-between">
        <Block className="h-4 w-24" />
        <Block className="h-4 w-20" />
      </div>
    </div>
  );
}

export default function ItemStreamSkeleton({
  view,
  count
}: ItemStreamSkeletonProps) {
  const isGallery = view === "gallery";
  const skeletonCount = count ?? (isGallery ? 4 : 6);
  const cards = Array.from({ length: skeletonCount }, (_, index) => (
    <SkeletonCard key={`skeleton-${index}`} />
  ));

  return (
    <div className={isGallery ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
      {cards}
    </div>
  );
}
