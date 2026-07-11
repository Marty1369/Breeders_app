import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader, Toggle } from '../components/ui';
import { niceDate } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import type { Dog, Litter, LitterStatus } from '../lib/types';

const STATUS_LABEL: Record<LitterStatus, string> = {
  planned: 'Planned', pregnant: 'Pregnant', born: 'Nursing', closed: 'Closed', did_not_take: 'Did not take',
};
const STATUS_TONE: Record<LitterStatus, 'default' | 'accent' | 'amber' | 'danger'> = {
  planned: 'default', pregnant: 'accent', born: 'accent', closed: 'default', did_not_take: 'danger',
};

const isTerminal = (l: Litter) => l.status === 'closed' || l.status === 'did_not_take';

export default function Litters() {
  const { litters, dogs, tasks, puppies, activeLitterId, setActiveLitterId } = useSpace();
  const navigate = useNavigate();

  // Optimistic active-state so the toggle responds instantly instead of waiting
  // for the realtime round-trip. Cleared per-litter once the server value catches up.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setPending((p) => {
      let changed = false;
      const next = { ...p };
      for (const l of litters) {
        if (l.id in next && next[l.id] === l.is_active) {
          delete next[l.id];
          changed = true;
        }
      }
      return changed ? next : p;
    });
  }, [litters]);
  const isActive = (l: Litter) => pending[l.id] ?? l.is_active;

  const dogName = (id: string | null) => dogs.find((d: Dog) => d.id === id)?.name ?? '—';

  const activeLitters = litters.filter((l) => isActive(l) && !isTerminal(l));
  const groups: { title: string; hint?: string; items: Litter[] }[] = [
    { title: 'Active', hint: 'Shown on the dashboard and switcher', items: activeLitters },
    { title: 'Inactive', hint: 'Shelved — kept, but out of the way', items: litters.filter((l) => !isActive(l) && !isTerminal(l)) },
    { title: 'Archive', hint: 'Closed or did-not-take', items: litters.filter(isTerminal) },
  ];

  async function setActive(litter: Litter, active: boolean) {
    setPending((p) => ({ ...p, [litter.id]: active })); // instant feedback
    const { error } = await supabase.from('litters').update({ is_active: active }).eq('id', litter.id);
    if (error) {
      setPending((p) => {
        const next = { ...p };
        delete next[litter.id];
        return next;
      });
      return;
    }
    if (!active && litter.id === activeLitterId) {
      // deactivating the current litter → hand focus to another active one
      const next = litters.find((l) => l.id !== litter.id && isActive(l) && !isTerminal(l));
      setActiveLitterId(next?.id ?? null);
    }
    if (active && !activeLitterId) setActiveLitterId(litter.id);
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader title="Litters" action={<Button icon="＋" onClick={() => navigate('/dogs?new_litter=1')}>New litter</Button>} />

      {litters.length === 0 ? (
        <EmptyState title="No litters yet" subtitle="Start your first litter from a dam on My dogs." action={<Button onClick={() => navigate('/dogs?new_litter=1')}>＋ New litter</Button>} />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.title}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-[11px] font-extrabold tracking-wide text-faint">{g.title.toUpperCase()}</div>
                    {g.hint && <div className="text-[10px] text-faint font-semibold">· {g.hint}</div>}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {g.items.map((l) => {
                      const whelping = effectiveDate(l.dates, 'whelping');
                      const handover = effectiveDate(l.dates, 'handover');
                      const nTasks = tasks.filter((t) => t.litter_id === l.id && t.status !== 'done').length;
                      const nPups = puppies.filter((p) => p.litter_id === l.id && p.status !== 'deceased').length;
                      const terminal = isTerminal(l);
                      const isCurrent = l.id === activeLitterId;
                      return (
                        <Card key={l.id} className={`p-4 ${isActive(l) || terminal ? '' : 'opacity-70'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[15px] font-extrabold">{l.name}</span>
                                {isCurrent && <Chip tone="accent">● Current</Chip>}
                                <Chip tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Chip>
                              </div>
                              <div className="text-[11px] text-faint font-semibold mt-0.5">{dogName(l.dam_id)} × {dogName(l.sire_id)}</div>
                            </div>
                            {!terminal && (
                              <div className="flex flex-col items-end gap-1 flex-none">
                                <Toggle checked={isActive(l)} onChange={(v) => setActive(l, v)} />
                                <span className="text-[9.5px] font-extrabold text-faint">{isActive(l) ? 'ACTIVE' : 'INACTIVE'}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] text-muted font-semibold mt-2">
                            {whelping ? `Whelping ${niceDate(whelping)}` : 'Not whelped'}{handover ? ` · handover ${niceDate(handover)}` : ''}
                            {' · '}{nPups} pup{nPups === 1 ? '' : 's'} · {nTasks} open task{nTasks === 1 ? '' : 's'}
                          </div>
                          <div className="flex gap-2 mt-3">
                            {isActive(l) && !isCurrent && (
                              <Button variant="secondary" size="sm" onClick={() => setActiveLitterId(l.id)}>Set as current</Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => { if (isActive(l)) setActiveLitterId(l.id); navigate(`/litters/${l.id}`); }}>Open dates & tasks →</Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
