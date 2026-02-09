"use client";

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/80 motion-reduce:animate-none dark:bg-neutral-800/70 ${className}`}
    />
  );
}

export default function ItemEditorFallback() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Block className="h-7 w-16 rounded-full" />
      </div>
      <Block className="h-52 w-full rounded-2xl" />
    </div>
  );
}
