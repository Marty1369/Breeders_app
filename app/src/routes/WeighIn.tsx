import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { todayStr } from '../lib/dates';
import { hasWeightAlert } from '../lib/scheduling';
import { notifyMembers } from '../lib/actions';

export default function WeighIn() {
  const { litters, activeLitterId, puppies, members, space } = useSpace();
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies.filter((p) => p.litter_id === activeLitterId && p.status !== 'deceased');
  const today = todayStr();

  const [session, setSession] = useState<'am' | 'pm'>('am');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  const valueFor = (puppyId: string) => {
    if (values[puppyId] !== undefined) return values[puppyId];
    const existing = litterPuppies.find((p) => p.id === puppyId)?.weigh_log[today]?.[session];
    return existing != null ? String(existing) : '';
  };

  const saveAll = async () => {
    setBusy(true);
    let alert = false;
    await Promise.all(
      litterPuppies.map(async (p) => {
        const raw = valueFor(p.id);
        if (!raw) return;
        const grams = Number(raw);
        const weigh_log = { ...p.weigh_log, [today]: { ...p.weigh_log[today], [session]: grams } };
        await supabase.from('puppies').update({ weigh_log }).eq('id', p.id);
        if (hasWeightAlert(weigh_log)) alert = true;
      })
    );
    if (alert && space) {
      await notifyMembers(space.id, members, 'weight_alert', `${litter.name}: flat weight gain detected`, 'Check the weigh-in log for puppies gaining ≤5g over 4 logs.', litter.id);
    }
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Weigh-in" subtitle={litter.name} />

      <div className="mb-4">
        <SegmentedControl value={session} onChange={setSession} options={[{ value: 'am', label: 'Morning' }, { value: 'pm', label: 'Evening' }]} />
      </div>

      {litterPuppies.length === 0 ? (
        <EmptyState title="No puppies yet" subtitle="Puppies appear here once logged in the birth log." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {litterPuppies.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-extrabold">{p.name}</div>
                <div className="text-[10.5px] text-faint font-semibold">{p.sex === 'female' ? '♀' : p.sex === 'male' ? '♂' : '—'} {p.color || ''}</div>
              </div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="grams"
                value={valueFor(p.id)}
                onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                className="w-28 text-right text-[16px] font-extrabold px-3 py-2.5 rounded-[10px] border border-border"
              />
            </Card>
          ))}
        </div>
      )}

      {litterPuppies.length > 0 && (
        <Button onClick={saveAll} disabled={busy} className="w-full mt-4 !min-h-14 !text-[15px]">
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save all weights'}
        </Button>
      )}
    </div>
  );
}
