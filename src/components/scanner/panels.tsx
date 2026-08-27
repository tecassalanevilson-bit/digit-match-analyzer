import { memo } from "react";
import type { Candidate, Condition, DigitStats } from "@/lib/digit-analysis";
import { cn } from "@/lib/utils";

export function Card({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-4", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-gold uppercase">
        {icon ? <span aria-hidden>{icon}</span> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md bg-surface-2/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className={cn("font-mono text-base font-bold", tone)}>{value}</p>
    </div>
  );
}

export const conditionTone = (c: Condition) =>
  c === "FORTE"
    ? "text-success"
    : c === "MODERADA"
      ? "text-gold"
      : "text-destructive";

export const conditionDot = (c: Condition) => (c === "FORTE" ? "🟢" : c === "MODERADA" ? "🟡" : "🔴");

export const LastDigits = memo(function LastDigits({ digits }: { digits: number[] }) {
  const last = digits.slice(-20);
  return (
    <div className="flex flex-wrap gap-1.5">
      {last.length === 0 ? <span className="text-sm text-muted-foreground">Sem dados</span> : null}
      {last.map((d, i) => (
        <span
          key={`${i}-${d}`}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-sm font-bold",
            i === last.length - 1 && "border-gold bg-gold text-gold-foreground",
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
});

export const Distribution = memo(function Distribution({ stats }: { stats: DigitStats[] }) {
  const max = Math.max(10, ...stats.map((s) => s.pctTotal));
  return (
    <div className="space-y-1.5">
      {stats.map((s) => {
        const dot = s.deviation > 1 ? "🟢" : s.deviation < -1 ? "🔴" : "⚪";
        const tone =
          s.deviation > 1 ? "bg-success" : s.deviation < -1 ? "bg-destructive" : "bg-primary";
        return (
          <div key={s.digit} className="flex items-center gap-2">
            <span className="w-5 font-mono text-sm font-bold text-gold">{s.digit}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className={cn("h-full rounded-sm", tone)}
                style={{ width: `${(s.pctTotal / max) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {s.countTotal}x · {s.pctTotal.toFixed(1)}%
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-[11px]">
              {dot} {s.deviation >= 0 ? "+" : ""}
              {s.deviation.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export const DigitTable = memo(function DigitTable({ stats }: { stats: DigitStats[] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left font-mono text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="px-1 py-1">Díg</th>
            <th className="px-1 py-1">20t</th>
            <th className="px-1 py-1">50t</th>
            <th className="px-1 py-1">Janela</th>
            <th className="px-1 py-1">Δ10%</th>
            <th className="px-1 py-1">Gap</th>
            <th className="px-1 py-1">Seq</th>
            <th className="px-1 py-1">Máx</th>
            <th className="px-1 py-1">Estab.</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.digit} className="border-t border-border/60">
              <td className="px-1 py-1 font-bold text-gold">{s.digit}</td>
              <td className="px-1 py-1">{s.pct20.toFixed(0)}%</td>
              <td className="px-1 py-1">{s.pct50.toFixed(0)}%</td>
              <td className="px-1 py-1">{s.pctTotal.toFixed(1)}%</td>
              <td
                className={cn(
                  "px-1 py-1",
                  s.deviation > 0 ? "text-success" : s.deviation < 0 ? "text-destructive" : "",
                )}
              >
                {s.deviation >= 0 ? "+" : ""}
                {s.deviation.toFixed(1)}
              </td>
              <td className="px-1 py-1">{s.gap}</td>
              <td className="px-1 py-1">{s.currentStreak}</td>
              <td className="px-1 py-1">{s.maxStreak}</td>
              <td className="px-1 py-1">{(s.stability * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export const CandidateRow = memo(function CandidateRow({
  medal,
  c,
}: {
  medal: string;
  c: Candidate;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface-2/60 px-3 py-2">
      <span aria-hidden className="text-lg">
        {medal}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-mono text-base font-bold text-primary-foreground">
        {c.digit}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-bold">
          {c.score}/100 <span className="text-muted-foreground">· {c.pctTotal.toFixed(1)}%</span>
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          20t {c.pct20.toFixed(0)}% · 50t {c.pct50.toFixed(0)}% · gap {c.gap}
          {c.conflict ? " · ⚠️ conflito" : ""}
        </p>
      </div>
    </div>
  );
});

export const WindowConfirm = memo(function WindowConfirm({ stats }: { stats: DigitStats[] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[460px] text-left font-mono text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="px-1 py-1">Díg</th>
            <th className="px-1 py-1">20</th>
            <th className="px-1 py-1">50</th>
            <th className="px-1 py-1">100</th>
            <th className="px-1 py-1">300</th>
            <th className="px-1 py-1">500</th>
            <th className="px-1 py-1">Tendência</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const spread = Math.max(s.pct20, s.pct50, s.pct100) - Math.min(s.pct20, s.pct50, s.pct100);
            const conflict = spread > 9;
            return (
              <tr key={s.digit} className="border-t border-border/60">
                <td className="px-1 py-1 font-bold text-gold">{s.digit}</td>
                <td className="px-1 py-1">{s.pct20.toFixed(0)}%</td>
                <td className="px-1 py-1">{s.pct50.toFixed(0)}%</td>
                <td className="px-1 py-1">{s.pct100.toFixed(0)}%</td>
                <td className="px-1 py-1">{s.pct300.toFixed(0)}%</td>
                <td className="px-1 py-1">{s.pct500.toFixed(0)}%</td>
                <td
                  className={cn(
                    "px-1 py-1",
                    conflict
                      ? "text-destructive"
                      : s.trend === "SUBINDO"
                        ? "text-success"
                        : s.trend === "DESCENDO"
                          ? "text-destructive"
                          : "text-muted-foreground",
                  )}
                >
                  {conflict ? "⚠️ CONFLITO" : s.trend}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
