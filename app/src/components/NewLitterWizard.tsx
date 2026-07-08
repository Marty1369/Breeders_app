import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Select, Sheet, TextField } from './ui';
import { todayStr } from '../lib/dates';
import { recomputeLitterDates, tasksFromTemplates } from '../lib/scheduling';
import { defaultRulesForLitter } from '../lib/recurrence';
import type { Dog } from '../lib/types';

function nextLetter(existing: string[]): string {
  const used = new Set(existing.map((s) => s.toUpperCase()));
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    if (!used.has(letter)) return letter;
  }
  return 'A';
}

export default function NewLitterWizard({
  open,
  onClose,
  prefillDam,
  prefillSire,
}: {
  open: boolean;
  onClose: () => void;
  prefillDam?: Dog | null;
  prefillSire?: Dog | null;
}) {
  const { space, dogs, litters, taskTemplates, setActiveLitterId } = useSpace();
  const navigate = useNavigate();

  const females = dogs.filter((d) => d.sex === 'female');
  const males = dogs.filter((d) => d.sex === 'male');
  const letter = nextLetter(litters.map((l) => l.letter || ''));

  const [damId, setDamId] = useState('');
  const [sireId, setSireId] = useState('');
  const [addingStud, setAddingStud] = useState(false);
  const [studName, setStudName] = useState('');
  const [studOwner, setStudOwner] = useState('');
  const [studPhone, setStudPhone] = useState('');
  const [studCity, setStudCity] = useState('');
  const [name, setName] = useState(`Litter ${letter}`);
  const [heatStart, setHeatStart] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDamId(prefillDam?.id || females[0]?.id || '');
    setSireId(prefillSire?.id || '');
    setName(`Litter ${letter}`);
    setHeatStart(todayStr());
    setAddingStud(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    if (!space || !damId) return;
    setBusy(true);
    setError(null);
    try {
      let finalSireId = sireId || null;
      if (addingStud) {
        if (!studName.trim()) throw new Error('Enter the stud\'s name');
        const { data, error: err } = await supabase
          .from('dogs')
          .insert({
            space_id: space.id,
            name: studName.trim(),
            sex: 'male',
            is_external: true,
            external_owner: { name: studOwner, phone: studPhone, city: studCity },
          })
          .select('id')
          .single();
        if (err) throw err;
        finalSireId = data.id;
      }

      const dates = recomputeLitterDates({ heat: { predicted: null, actual: heatStart } });

      const { data: litter, error: litErr } = await supabase
        .from('litters')
        .insert({
          space_id: space.id,
          name: name.trim() || `Litter ${letter}`,
          letter,
          dam_id: damId,
          sire_id: finalSireId,
          status: 'planned',
          dates,
        })
        .select('*')
        .single();
      if (litErr) throw litErr;

      const dam = dogs.find((d) => d.id === damId);
      if (dam) {
        await supabase
          .from('dogs')
          .update({ heats: [...dam.heats, { startedAt: heatStart }] })
          .eq('id', damId);
      }

      const taskRows = tasksFromTemplates(taskTemplates, { id: litter.id, space_id: space.id }, dates);
      if (taskRows.length) {
        const { error: taskErr } = await supabase.from('tasks').insert(taskRows);
        if (taskErr) throw taskErr;
      }

      const ruleRows = defaultRulesForLitter({ id: litter.id, space_id: space.id }, dates);
      if (ruleRows.length) {
        const { error: ruleErr } = await supabase.from('recurrence_rules').insert(ruleRows);
        if (ruleErr) throw ruleErr;
      }

      setActiveLitterId(litter.id);
      onClose();
      navigate('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create litter');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New litter"
      subtitle={`~${taskTemplates.reduce((n, t) => n + (t.repeat?.count ?? 1), 0)} tasks will be generated automatically`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !damId}>{busy ? 'Creating…' : 'Create litter'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Litter name" value={name} onChange={(e) => setName(e.target.value)} />

        <Select label="Dam" value={damId} onChange={(e) => setDamId(e.target.value)} required>
          <option value="" disabled>Select dam…</option>
          {females.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>

        {!addingStud ? (
          <Select label="Sire" value={sireId} onChange={(e) => (e.target.value === '__new__' ? setAddingStud(true) : setSireId(e.target.value))}>
            <option value="">Not decided yet</option>
            {males.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.is_external ? ' (external)' : ''}</option>
            ))}
            <option value="__new__">＋ Add external stud…</option>
          </Select>
        ) : (
          <div className="flex flex-col gap-3 bg-app-bg border border-border-soft rounded-[10px] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-muted">EXTERNAL STUD</span>
              <button onClick={() => setAddingStud(false)} className="text-[11px] font-extrabold text-accent cursor-pointer">Use existing instead</button>
            </div>
            <TextField label="Stud name" value={studName} onChange={(e) => setStudName(e.target.value)} />
            <TextField label="Owner name" value={studOwner} onChange={(e) => setStudOwner(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Owner phone" value={studPhone} onChange={(e) => setStudPhone(e.target.value)} />
              <TextField label="City" value={studCity} onChange={(e) => setStudCity(e.target.value)} />
            </div>
          </div>
        )}

        <TextField label="Heat start date" type="date" value={heatStart} onChange={(e) => setHeatStart(e.target.value)} />

        <div className="text-[11px] text-faint font-semibold bg-muted-bg rounded-[10px] px-3 py-2.5 leading-relaxed">
          Ovulation, mating, whelping, weaning, and handover dates are predicted from this heat date using the
          kennel's formulas. You can override any of them later — dependent tasks re-shift automatically.
        </div>

        {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
      </div>
    </Sheet>
  );
}
