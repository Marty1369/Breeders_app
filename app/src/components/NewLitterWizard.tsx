import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Select, Sheet, TextField } from './ui';
import { todayStr, addDays, niceDate } from '../lib/dates';
import { recomputeLitterDates, tasksFromTemplates, effectiveDate } from '../lib/scheduling';
import { defaultRulesForLitter } from '../lib/recurrence';
import DogFormSheet from './DogFormSheet';
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
  const [addSireOpen, setAddSireOpen] = useState(false);
  const [name, setName] = useState(`Litter ${letter}`);
  const [heatStart, setHeatStart] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live predicted plan from the heat date (pure — no writes). Same computation
  // submit() uses, so the preview matches exactly what gets created.
  const preview = useMemo(() => {
    if (!heatStart) return null;
    const dates = recomputeLitterDates({ heat: { predicted: null, actual: heatStart } });
    const taskCount = tasksFromTemplates(taskTemplates, { id: 'preview', space_id: space?.id ?? '' }, dates).length;
    return {
      fertileStart: addDays(heatStart, 11),
      fertileEnd: addDays(heatStart, 15),
      whelping: effectiveDate(dates, 'whelping'),
      handover: effectiveDate(dates, 'handover'),
      taskCount,
    };
  }, [heatStart, taskTemplates, space?.id]);

  useEffect(() => {
    if (!open) return;
    setDamId(prefillDam?.id || females[0]?.id || '');
    setSireId(prefillSire?.id || '');
    setName(`Litter ${letter}`);
    setHeatStart(todayStr());
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    if (!space || !damId) return;
    setBusy(true);
    setError(null);
    try {
      const finalSireId = sireId || null;

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
    <>
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

        <Select label="Mum (dam)" value={damId} onChange={(e) => setDamId(e.target.value)} required>
          <option value="" disabled>Select mum…</option>
          {females.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>

        <Select label="Dad (sire)" value={sireId} onChange={(e) => (e.target.value === '__new__' ? setAddSireOpen(true) : setSireId(e.target.value))}>
          <option value="">Not decided yet</option>
          {males.map((d) => (
            <option key={d.id} value={d.id}>{d.name}{d.is_external ? ' (external)' : ''}</option>
          ))}
          <option value="__new__">＋ Add new sire…</option>
        </Select>

        <TextField label="Heat start date" type="date" value={heatStart} onChange={(e) => setHeatStart(e.target.value)} />

        {preview && (
          <div className="rounded-[14px] p-4 text-white" style={{ background: '#123f2d' }}>
            <div className="text-[10px] font-extrabold tracking-wider" style={{ color: '#7fd4ae' }}>HERE'S YOUR PREDICTED PLAN</div>
            <div className="flex flex-col gap-1.5 mt-2 text-[13px] font-semibold">
              <div>Best breeding days <span className="font-extrabold">{niceDate(preview.fertileStart)} – {niceDate(preview.fertileEnd)}</span></div>
              {preview.whelping && <div>Puppies born around <span className="font-extrabold">{niceDate(preview.whelping)}</span></div>}
              {preview.handover && <div>Puppies go home around <span className="font-extrabold">{niceDate(preview.handover)}</span></div>}
            </div>
            <div className="my-3 h-px bg-white/15" />
            <div className="text-[12px] font-semibold leading-relaxed opacity-90">
              <div><span style={{ color: '#7fd4ae' }}>✓</span> {preview.taskCount} tasks &amp; reminders will be planned for you</div>
              <div>Dates shift automatically when real dates come in.</div>
            </div>
          </div>
        )}

        {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
      </div>
    </Sheet>

    <DogFormSheet
      open={addSireOpen}
      dog={null}
      litterCount={0}
      defaultSex="male"
      onCreated={(id) => setSireId(id)}
      onClose={() => setAddSireOpen(false)}
    />
    </>
  );
}
