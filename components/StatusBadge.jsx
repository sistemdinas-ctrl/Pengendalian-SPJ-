import { STATUS_META } from "@/lib/domain";

const TONE = {
  slate: "bg-slate-100/80 text-slate-700 ring-slate-200/60",
  blue: "bg-blue-50/80 text-blue-700 ring-blue-200/60",
  indigo: "bg-indigo-50/80 text-indigo-700 ring-indigo-200/60",
  amber: "bg-amber-50/80 text-amber-800 ring-amber-200/60",
  cyan: "bg-cyan-50/80 text-cyan-800 ring-cyan-200/60",
  emerald: "bg-emerald-50/80 text-emerald-700 ring-emerald-200/60",
  rose: "bg-rose-50/80 text-rose-700 ring-rose-200/60",
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "slate" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
        TONE[meta.tone]
      }`}
    >
      <span
        aria-hidden
        className="w-1.5 h-1.5 rounded-full bg-current"
      />
      {meta.label}
    </span>
  );
}
