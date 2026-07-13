import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Button, Card, Chip, CollarAvatar, EmptyState, PageHeader } from '../components/ui';
import { CrossIcon, HeartPulseIcon, ScaleIcon } from '../components/icons';
import { hasWeightAlert } from '../lib/scheduling';
import { isLitterTerminal } from '../lib/stages';
import type { Puppy, PuppyStatus } from '../lib/types';

const STATUS_TONE: Record<PuppyStatus, 'default' | 'accent' | 'amber' | 'danger'> = {
  available: 'accent',
  reserved: 'amber',
  coowned: 'amber',
  export: 'amber',
  deceased: 'danger',
};

function Sparkline({ weighLog }: { weighLog: Puppy['weigh_log'] }) {
  const days = Object.keys(weighLog).sort();
  const points = days.map((d) => weighLog[d].pm ?? weighLog[d].am ?? 0).filter((v) => v > 0);
  if (points.length < 2) return <div className="h-6" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 72;
  const h = 24;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((p - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke="#17805a" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Average daily gain (g/day) across a puppy's weigh_log: latest reading minus
 *  earliest, over the number of days between them. Null until 2+ dated readings. */
function gramsPerDay(weighLog: Puppy['weigh_log']): number | null {
  const days = Object.keys(weighLog).sort();
  const reads = days
    .map((d) => ({ date: d, g: weighLog[d].pm ?? weighLog[d].am }))
    .filter((r): r is { date: string; g: number } => r.g != null);
  if (reads.length < 2) return null;
  const first = reads[0];
  const last = reads[reads.length - 1];
  const spanDays = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
  if (spanDays <= 0) return null;
  return Math.round((last.g - first.g) / spanDays);
}

export default function Puppies() {
  const { litters, activeLitterId, puppies } = useSpace();
  const navigate = useNavigate();
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies.filter((p) => p.litter_id === activeLitterId);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader title="Puppies" subtitle={litter?.name} />

      {/* Care actions live where the puppies live (spec §2.1 / audit #2):
          weigh-in, health log and the birth log launch from here. */}
      {litter && !isLitterTerminal(litter) && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" icon={<ScaleIcon size={15} />} onClick={() => navigate('/weigh-in')}>Weigh now</Button>
          <Button variant="secondary" size="sm" icon={<CrossIcon size={15} />} onClick={() => navigate('/health-log')}>Health entry</Button>
          <Button variant="secondary" size="sm" icon={<HeartPulseIcon size={15} />} onClick={() => navigate('/whelping')}>Birth log</Button>
        </div>
      )}

      {litterPuppies.length === 0 ? (
        <EmptyState
          title="No puppies yet"
          subtitle="Puppies are added from the whelping birth log as they're born."
          action={litter && !isLitterTerminal(litter) ? <Button onClick={() => navigate('/whelping')}>Open birth log</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {litterPuppies.map((p) => {
            const alert = hasWeightAlert(p.weigh_log);
            const latestWeight = Object.keys(p.weigh_log)
              .sort()
              .reverse()
              .map((d) => p.weigh_log[d].pm ?? p.weigh_log[d].am)
              .find((v) => v != null);
            const gpd = gramsPerDay(p.weigh_log);
            return (
              <Card
                key={p.id}
                onClick={() => navigate(`/puppies/${p.id}`)}
                className="p-3.5 cursor-pointer flex items-center gap-3"
                style={alert ? { borderColor: '#d9a05c', borderWidth: 2 } : undefined}
              >
                <CollarAvatar name={p.name} collar={p.collar_color} size={48} className="flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-extrabold truncate">{p.name}</div>
                  <div className="text-[12px] text-faint font-semibold truncate">
                    {p.sex === 'female' ? '♀' : p.sex === 'male' ? '♂' : '—'} · {p.color || '—'}{latestWeight ? ` · ${latestWeight} g` : ''}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip>
                    {gpd != null && (
                      <span className={`text-[12px] font-extrabold ${gpd < 0 ? 'text-danger' : 'text-accent'}`}>
                        {gpd >= 0 ? '+' : '−'}{Math.abs(gpd)} g/day {gpd > 0 ? '↑' : gpd < 0 ? '↓' : ''}
                      </span>
                    )}
                  </div>
                  {alert && <div className="text-[12px] font-extrabold text-amber mt-1">flat gain — watch</div>}
                </div>
                <Sparkline weighLog={p.weigh_log} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
