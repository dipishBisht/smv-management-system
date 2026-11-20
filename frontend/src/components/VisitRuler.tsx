import { fmtDuration, fmtTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

const H = 3_600_000;

/**
 * The scheduled slot (dashed) against what actually happened (solid bars, one per on-site visit).
 * A late visit turns amber; a visit still in progress is hatched; the blue marker is the agreed return time.
 */
export function VisitRuler({ m }: { m: Meeting }) {
  const now = Date.now();
  const t = (s: string) => new Date(s).getTime();
  const visits = m.visits.map((v) => ({
    ...v,
    a: t(v.checkInAt),
    b: v.checkOutAt ? t(v.checkOutAt) : now,
    open: !v.checkOutAt,
  }));
  const next = m.nextVisitAt ? t(m.nextVisitAt) : null;

  const points = [
    t(m.scheduledStart),
    t(m.scheduledEnd),
    ...visits.flatMap((v) => [v.a, v.b]),
    ...(next ? [next] : []),
  ];
  const lo = Math.floor((Math.min(...points) - 20 * 60_000) / H) * H;
  const hi = Math.ceil((Math.max(...points) + 20 * 60_000) / H) * H;
  const span = hi - lo;
  const pct = (x: number) => ((x - lo) / span) * 100;
  const step =
    span <= 6 * H
      ? H
      : span <= 12 * H
        ? 2 * H
        : span <= 24 * H
          ? 3 * H
          : span <= 72 * H
            ? 12 * H
            : 24 * H;
  const ticks: number[] = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi; x += step) ticks.push(x);
  const tickPct = (step / span) * 100;
  const multiDay = span > 24 * H;

  return (
    <div className="ruler">
      <div
        className="ruler-track"
        role="img"
        aria-label={`Scheduled ${fmtTime(m.scheduledStart)} to ${fmtTime(m.scheduledEnd)}. ${visits.length} visit${visits.length === 1 ? "" : "s"} recorded.`}
        style={{
          ["--tick" as string]: `${tickPct}%`,
          marginTop: next ? "1.4rem" : 0,
        }}
      >
        <div
          className="ruler-band planned"
          style={{
            left: `${pct(t(m.scheduledStart))}%`,
            width: `${pct(t(m.scheduledEnd)) - pct(t(m.scheduledStart))}%`,
          }}
        />
        {visits.map((v, i) => (
          <div
            key={i}
            className={`ruler-band visit ${v.lateMinutes ? "late" : ""} ${v.open ? "open" : ""}`}
            style={{
              left: `${pct(v.a)}%`,
              width: `${Math.max(0.6, pct(v.b) - pct(v.a))}%`,
            }}
            title={`Visit ${i + 1}: ${fmtTime(v.a)} to ${v.open ? "now" : fmtTime(v.b)}`}
          />
        ))}
        {next && (
          <div
            className="ruler-marker"
            data-label={`Return ${fmtTime(next)}`}
            style={{ left: `${pct(next)}%` }}
          />
        )}
      </div>
      <div className="ruler-ticks" aria-hidden="true">
        {ticks.map((x) => (
          <span key={x} style={{ left: `${pct(x)}%` }}>
            {multiDay
              ? new Date(x).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                })
              : new Date(x).toLocaleTimeString([], { hour: "numeric" })}
          </span>
        ))}
      </div>
      <ul className="ruler-legend">
        <li>
          <span className="swatch planned" />
          Scheduled {fmtTime(m.scheduledStart)} to {fmtTime(m.scheduledEnd)}
        </li>
        {visits.map((v, i) => (
          <li key={i}>
            <span className={`swatch ${v.lateMinutes ? "late" : "visit"}`} />
            Visit {i + 1}: {fmtTime(v.a)} to {v.open ? "now" : fmtTime(v.b)} (
            {fmtDuration((v.b - v.a) / 60000)})
            {v.lateMinutes ? `, ${v.lateMinutes} min late` : ", on time"}
          </li>
        ))}
        {visits.length === 0 && (
          <li className="muted">
            No visits yet. The bars appear here as soon as you check in.
          </li>
        )}
      </ul>
    </div>
  );
}
