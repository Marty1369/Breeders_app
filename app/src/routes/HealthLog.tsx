import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader, Select, TextField } from '../components/ui';
import { longDate, todayStr } from '../lib/dates';
import { isLitterTerminal } from '../lib/stages';
import type { HealthEntry } from '../lib/types';

const TYPE_LABEL: Record<HealthEntry['type'], string> = {
  vaccination: 'Vaccination',
  deworming: 'Deworming',
  vet_check: 'Vet check',
  medication: 'Medication',
};

export default function HealthLog() {
  const { litters, activeLitterId, puppies, healthEntries, space } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies.filter((p) => p.litter_id === activeLitterId);
  const entries = healthEntries.filter((e) => e.litter_id === activeLitterId).sort((a, b) => b.date.localeCompare(a.date));

  const [type, setType] = useState<HealthEntry['type']>('vaccination');
  const [product, setProduct] = useState('');
  const [date, setDate] = useState(todayStr());
  const [scope, setScope] = useState<'all' | string[]>('all');
  const [busy, setBusy] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  function togglePuppy(id: string) {
    setScope((s) => {
      const arr = s === 'all' ? [] : s;
      return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    });
  }

  const litterClosed = isLitterTerminal(litter);

  const save = async () => {
    if (!space || !product.trim() || litterClosed) return;
    setBusy(true);
    await supabase.from('health_entries').insert({
      space_id: space.id,
      litter_id: litter.id,
      type,
      product: product.trim(),
      date,
      applies_to: scope,
      by_user_id: user?.id,
    });
    setBusy(false);
    setProduct('');
    setScope('all');
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Health log" subtitle={litter.name} />

      {litterClosed && (
        <div className="mb-3 text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
          {litter.name} is closed — the health record is read-only.
        </div>
      )}
      {!litterClosed && (
      <Card className="p-4 mb-5">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">NEW ENTRY</div>
        <div className="flex flex-col gap-3">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as HealthEntry['type'])}>
            <option value="vaccination">Vaccination</option>
            <option value="deworming">Deworming</option>
            <option value="vet_check">Vet check</option>
            <option value="medication">Medication</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Product" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Panacur, DHPPi…" />
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">APPLIES TO</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer ${scope === 'all' ? 'bg-accent text-white' : 'bg-chip-bg text-muted'}`}
              >
                Whole litter
              </button>
              {litterPuppies.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePuppy(p.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer ${scope !== 'all' && scope.includes(p.id) ? 'bg-accent text-white' : 'bg-chip-bg text-muted'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={busy || !product.trim()}>{busy ? 'Saving…' : 'Add entry'}</Button>
        </div>
      </Card>
      )}

      <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">HISTORY</div>
      {entries.length === 0 ? (
        <EmptyState title="No health entries yet" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between bg-card border border-card-border rounded-[10px] px-3 py-2.5">
              <div>
                <div className="text-[12.5px] font-extrabold">{TYPE_LABEL[e.type]} — {e.product}</div>
                <div className="text-[10.5px] text-faint font-semibold">
                  {e.applies_to === 'all' ? 'Whole litter' : `${(e.applies_to as string[]).length} puppies`}
                </div>
              </div>
              <div className="text-[11px] font-bold text-muted">{longDate(e.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
