"use client";

export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: "sm" | "md" | "lg" | "full";
}) {
  const roundedClass =
    rounded === "full" ? "rounded-full" :
    rounded === "lg" ? "rounded-lg" :
    rounded === "sm" ? "rounded-sm" : "rounded-md";
  return (
    <div
      className={`animate-pulse bg-gray-700/40 ${roundedClass} ${className}`}
      style={{ width, height }}
    />
  );
}

export function MatchupRowSkeleton() {
  return (
    <div
      className="rounded-lg border border-gray-700/40 bg-gray-800/40 grid items-center"
      style={{ gridTemplateColumns: "38px minmax(0, 300px) 46px 46px 84px 62px 62px 62px 62px 62px 62px", padding: "10px", gap: 6, justifyContent: "center" }}
    >
      <Skeleton width={30} height={30} rounded="full" />
      <div className="flex items-center gap-2 min-w-0">
        <Skeleton width={26} height={26} />
        <Skeleton className="flex-1" height={12} />
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} height={10} />
      ))}
    </div>
  );
}

export function MatchupTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton width={64} height={10} className="ml-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <MatchupRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function RivalsPanelSkeleton() {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <Skeleton width={120} height={16} className="mb-2" />
          <Skeleton width={260} height={10} />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={120} height={28} />
          <Skeleton width={150} height={28} />
        </div>
      </div>
      <MatchupTableSkeleton rows={10} />
    </div>
  );
}

export function UpcomingGamesSkeleton() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} width={120} height={64} rounded="lg" />
      ))}
    </div>
  );
}

