import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Card, Chip, EmptyState, PageHeader } from '../components/ui';
import { hasWeightAlert } from '../lib/scheduling';
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

export default function Puppies() {
  const { litters, activeLitterId, puppies } = useSpace();
  const navigate = useNavigate();
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies.filter((p) => p.litter_id === activeLitterId);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader title="Puppies" subtitle={litter?.name} />

      {litterPuppies.length === 0 ? (
        <EmptyState title="No puppies yet" subtitle="Puppies are added from the whelping birth log as they're born." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {litterPuppies.map((p) => {
            const alert = hasWeightAlert(p.weigh_log);
            const latestWeight = Object.keys(p.weigh_log)
              .sort()
              .reverse()
              .map((d) => p.weigh_log[d].pm ?? p.weigh_log[d].am)
              .find((v) => v != null);
            return (
              <Card key={p.id} onClick={() => navigate(`/puppies/${p.id}`)} className="p-3.5 cursor-pointer flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted-bg grid place-items-center text-[18px] flex-none">
                  {p.sex === 'female' ? '♀' : p.sex === 'male' ? '♂' : '🐾'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-extrabold truncate">{p.name}</span>
                    {alert && <span title="Flat weight gain">⚠️</span>}
                  </div>
                  <div className="text-[10.5px] text-faint font-semibold truncate">{p.color || '—'}{latestWeight ? ` · ${latestWeight}g` : ''}</div>
                  <div className="mt-1"><Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip></div>
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
