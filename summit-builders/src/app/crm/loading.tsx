export default function CrmLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="h-3 w-28 rounded bg-line" />
          <div className="mt-2 h-7 w-64 rounded bg-line" />
          <div className="mt-2 h-3 w-96 max-w-full rounded bg-line" />
        </div>
        <div className="h-9 w-44 rounded bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl border border-line bg-panel" />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="h-80 rounded-xl border border-line bg-panel xl:col-span-2" />
        <div className="h-80 rounded-xl border border-line bg-panel" />
      </div>
    </div>
  );
}
