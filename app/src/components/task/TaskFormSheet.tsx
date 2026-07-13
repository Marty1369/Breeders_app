import { useEffect, useState } from 'react';
import { useSpace } from '../../state/SpaceProvider';
import { supabase } from '../../lib/supabase';
import { Avatar, Button, Select, Sheet, TextField } from '../ui';
import { addDays, todayStr } from '../../lib/dates';
import { effectiveDate } from '../../lib/scheduling';
import type { AnchorKey } from '../../lib/scheduling';
import type { Task, TaskPhase } from '../../lib/types';
import { STAGE_ORDER, STAGE_LABEL } from '../../lib/stages';

const PHASES: { value: TaskPhase; label: string }[] = STAGE_ORDER.map((p) => ({ value: p, label: STAGE_LABEL[p] }));

const ANCHORS: { value: AnchorKey; label: string }[] = [
  { value: 'heat', label: 'Heat start' },
  { value: 'ovulation', label: 'Ovulation' },
  { value: 'mating', label: 'Mating' },
  { value: 'whelping', label: 'Whelping' },
  { value: 'handover', label: 'Handover' },
];

export default function TaskFormSheet({
  open,
  onClose,
  task,
  litterId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  litterId: string | null;
  defaultDate?: string;
}) {
  const { space, members, litters } = useSpace();
  const litter = litters.find((l) => l.id === litterId);
  const editing = !!task;

  const [name, setName] = useState('');
  const [phase, setPhase] = useState<TaskPhase>('prewhelp');
  const [mode, setMode] = useState<'fixed' | 'anchor+offset'>('fixed');
  const [fixedDate, setFixedDate] = useState(defaultDate || todayStr());
  const [anchor, setAnchor] = useState<AnchorKey>('whelping');
  const [offset, setOffset] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [repeatCount, setRepeatCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (task) {
      setName(task.name);
      setPhase(task.phase);
      setMode(task.anchor_mode);
      setFixedDate(task.start_date);
      setAnchor((task.anchor as AnchorKey) || 'whelping');
      setOffset(task.offset_days ?? 0);
      setPinned(task.is_pinned_date);
      setAssignees(task.assignee_ids);
      setNotes(task.notes || '');
    } else {
      setName('');
      setPhase('prewhelp');
      setMode('fixed');
      setFixedDate(defaultDate || todayStr());
      setAnchor('whelping');
      setOffset(0);
      setPinned(false);
      setAssignees([]);
      setNotes('');
      setRepeatEvery(1);
      setRepeatCount(1);
    }
  }, [open, task, defaultDate]);

  function toggleAssignee(id: string) {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function computeStart(): string {
    if (mode === 'fixed') return fixedDate;
    const anchorDate = litter ? effectiveDate(litter.dates, anchor) : null;
    return anchorDate ? addDays(anchorDate, offset) : fixedDate;
  }

  async function save() {
    if (!space || !litterId || !name.trim()) return;
    setBusy(true);
    setError(null);
    const start = computeStart();

    let dbError: { message: string } | null = null;
    if (editing && task) {
      ({ error: dbError } = await supabase
        .from('tasks')
        .update({
          name: name.trim(),
          phase,
          anchor_mode: mode,
          start_date: start,
          due_date: start,
          anchor: mode === 'anchor+offset' ? anchor : null,
          offset_days: mode === 'anchor+offset' ? offset : null,
          is_pinned_date: pinned,
          assignee_ids: assignees,
          notes: notes || null,
        })
        .eq('id', task.id));
    } else {
      const count = Math.max(1, repeatCount);
      const rows = Array.from({ length: count }).map((_, i) => {
        const s = mode === 'fixed' ? addDays(fixedDate, i * repeatEvery) : (() => {
          const anchorDate = litter ? effectiveDate(litter.dates, anchor) : null;
          return anchorDate ? addDays(anchorDate, offset + i * repeatEvery) : fixedDate;
        })();
        return {
          space_id: space.id,
          litter_id: litterId,
          name: count > 1 ? `${name.trim()} — day ${i + 1}` : name.trim(),
          phase,
          anchor_mode: mode,
          start_date: s,
          due_date: s,
          anchor: mode === 'anchor+offset' ? anchor : null,
          offset_days: mode === 'anchor+offset' ? offset + i * repeatEvery : null,
          is_pinned_date: pinned,
          assignee_ids: assignees,
          notes: notes || null,
          status: 'todo' as const,
        };
      });
      ({ error: dbError } = await supabase.from('tasks').insert(rows));
    }
    setBusy(false);
    if (dbError) {
      // A failed write must not close the sheet as if it saved (TASK-13).
      setError(dbError.message || 'Could not save the task. Try again.');
      return;
    }
    onClose();
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    setError(null);
    const { error: dbError } = await supabase.from('tasks').delete().eq('id', task.id);
    setBusy(false);
    if (dbError) {
      setError(dbError.message || 'Could not delete the task. Try again.');
      return;
    }
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <>
          {editing && <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <div className="text-[12px] font-bold text-danger">{error}</div>}
        <TextField label="Task name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Select label="Phase" value={phase} onChange={(e) => setPhase(e.target.value as TaskPhase)}>
          {PHASES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('fixed')}
            className={`flex-1 py-2 rounded-[10px] border text-[12px] font-extrabold cursor-pointer ${mode === 'fixed' ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'}`}
          >
            Fixed date
          </button>
          <button
            onClick={() => setMode('anchor+offset')}
            className={`flex-1 py-2 rounded-[10px] border text-[12px] font-extrabold cursor-pointer ${mode === 'anchor+offset' ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'}`}
          >
            Linked to a date
          </button>
        </div>

        {mode === 'fixed' ? (
          <TextField label="Date" type="date" value={fixedDate} onChange={(e) => setFixedDate(e.target.value)} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Linked to" value={anchor} onChange={(e) => setAnchor(e.target.value as AnchorKey)}>
              {ANCHORS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </Select>
            <TextField label="Offset (days)" type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
          </div>
        )}

        {mode === 'anchor+offset' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
            <span className="text-[12.5px] font-bold">Pin this date — don't move it if the anchor date changes</span>
          </label>
        )}

        {!editing && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Repeat every N days" type="number" min={1} value={repeatEvery} onChange={(e) => setRepeatEvery(Number(e.target.value))} />
            <TextField label="Occurrences" type="number" min={1} value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} />
          </div>
        )}

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">ASSIGNEES</div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => toggleAssignee(m.user_id)}
                className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border cursor-pointer ${assignees.includes(m.user_id) ? 'border-accent bg-accent-soft' : 'border-border'}`}
              >
                <Avatar name={m.name} color={m.avatar_color} size={22} />
                <span className="text-[11.5px] font-bold">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Sheet>
  );
}
