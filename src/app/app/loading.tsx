export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 rounded bg-slate-200 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-xl border bg-white">
            <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl border bg-white">
        <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
