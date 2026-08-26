import { bpsToPercentString } from '../domain/bps';

export interface OwnershipSegment {
  label: string;
  bps: number;
  color: string;
}

export function OwnershipBar({ segments, total = 10000 }: { segments: OwnershipSegment[]; total?: number }) {
  const allocated = segments.reduce((s, x) => s + x.bps, 0);
  const unallocated = Math.max(0, total - allocated);
  const allSegments = unallocated > 0
    ? [...segments, { label: 'Development Pool', bps: unallocated, color: 'bg-ink-200' }]
    : segments;

  return (
    <div>
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5 bg-ink-100">
        {allSegments.map((seg, i) => {
          const pct = (seg.bps / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={i}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${bpsToPercentString(seg.bps)}`}
            />
          );
        })}
      </div>
      <div className="mt-3 space-y-1.5">
        {allSegments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${seg.color}`} />
              <span className="text-ink-700 font-medium">{seg.label}</span>
            </div>
            <span className="text-ink-500 font-mono">{bpsToPercentString(seg.bps)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnershipDonut({ segments, total = 10000, size = 160 }: { segments: OwnershipSegment[]; total?: number; size?: number }) {
  const allocated = segments.reduce((s, x) => s + x.bps, 0);
  const unallocated = Math.max(0, total - allocated);
  const allSegments = unallocated > 0
    ? [...segments, { label: 'Development Pool', bps: unallocated, color: '#e2e8f0' }]
    : segments;

  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {allSegments.map((seg, i) => {
          const pct = seg.bps / total;
          const dash = pct * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-2">
        {allSegments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-ink-700 font-medium">{seg.label}</span>
            <span className="text-ink-400 font-mono text-xs">{bpsToPercentString(seg.bps)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
