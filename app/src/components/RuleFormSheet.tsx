import { useEffect, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Avatar, Button, Select, Sheet, TextField } from './ui';
import { todayStr } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import type { RecurrenceRule, RuleEndType, RuleFreq, RuleScope } from '../lib/types';

export default function RuleFormSheet({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule?: RecurrenceRule | null;
  onClose: () => void;
}) {
  const { space, members, litters, activeLitterId } = useSpace();
  const editing = !!rule;

  const [name, setName] = useState('');
  const [scope, setScope] = useState<RuleScope>('litter');
  const [freq, setFreq] = useState<RuleFreq>('daily');
  const [interval, setInterval] = useState(1);
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [newTime, setNewTime] = useState('12:00');
  const [startDate, setStartDate] = useState(todayStr());
  const [endType, setEndType] = useState<RuleEndType>('never');
  const [endKey, setEndKey] = useState('weaning');
  const [endDate, setEndDate] = useState('');
  const [endCount, setEndCount] = useState(10);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (rule) {
      setName(rule.name);
      setScope(rule.scope);
      setFreq(rule.freq);
      setInterval(rule.interval);
      setTimes(rule.times.length ? rule.times : ['08:00']);
      setStartDate(rule.start_date);
      setEndType(rule.end_type);
      setEndKey(rule.end_key || 'weaning');
      setEndDate(rule.end_date || '');
      setEndCount(rule.end_count || 10);
      setAssignees(rule.assignee_ids);
    } else {
      setName('');
      setScope(activeLitterId ? 'litter' : 'kennel');
      setFreq('daily');
      setInterval(1);
      setTimes(['08:00']);
      setStartDate(todayStr());
      setEndType('never');
      setEndKey('weaning');
      setEndDate('');
      setEndCount(10);
      setAssignees([]);
    }
  }, [open, rule, activeLitterId]);

  const activeLitter = litters.find((l) => l.id === activeLitterId);

  function addTime() {
    if (newTime && !times.includes(newTime)) setTimes((t) => [...t, newTime].sort());
  }
  function toggleAssignee(id: string) {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!space || !name.trim() || times.length === 0) return;
    setBusy(true);
    const payload = {
      space_id: space.id,
      litter_id: scope === 'litter' ? activeLitterId : null,
      name: name.trim(),
      scope,
      freq,
      interval: Math.max(1, interval),
      times,
      start_date: startDate,
      end_type: endType,
      end_key: endType === 'keydate' ? endKey : null,
      end_date: endType === 'date' ? endDate || null : null,
      end_count: endType === 'count' ? endCount : null,
      assignee_ids: assignees,
      // A manually edited rule becomes fixed — drop the whelping anchor so a
      // later litter-date change won't overwrite the dates the user just set.
      start_anchor: null,
      start_offset: null,
      end_anchor: null,
      end_offset: null,
    };
    setError(null);
    let dbError: { message: string } | null = null;
    if (editing && rule) {
      ({ error: dbError } = await supabase.from('recurrence_rules').update(payload).eq('id', rule.id));
    } else {
      ({ error: dbError } = await supabase.from('recurrence_rules').insert({ ...payload, paused: false }));
    }
    setBusy(false);
    if (dbError) {
      // A failed write must not close the sheet as if it saved (TASK-13).
      setError(dbError.message || 'Could not save the repeat. Try again.');
      return;
    }
    onClose();
  }

  async function remove() {
    if (!rule) return;
    setBusy(true);
    setError(null);
    const { error: dbError } = await supabase.from('recurrence_rules').delete().eq('id', rule.id);
    setBusy(false);
    if (dbError) {
      setError(dbError.message || 'Could not delete the repeat. Try again.');
      return;
    }
    onClose();
  }

  const freqLabel = freq === 'daily' ? 'day(s)' : freq === 'weekly' ? 'week(s)' : 'days';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit repeat' : 'New repeat'}
      subtitle="A task that recurs on a schedule"
      footer={
        <>
          {editing && <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim() || times.length === 0}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <div className="text-[12px] font-bold text-danger">{error}</div>}
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weigh puppies" autoFocus />

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">SCOPE</div>
          <div className="flex gap-2">
            <ScopeBtn active={scope === 'litter'} disabled={!activeLitter} onClick={() => setScope('litter')} label={activeLitter ? activeLitter.name : 'Litter'} />
            <ScopeBtn active={scope === 'kennel'} onClick={() => setScope('kennel')} label="Whole kennel" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Repeats" value={freq} onChange={(e) => setFreq(e.target.value as RuleFreq)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="everyN">Every N days</option>
          </Select>
          <TextField label={`Every (${freqLabel})`} type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
        </div>

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">TIMES OF DAY</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {times.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-accent-soft text-accent text-[11.5px] font-extrabold">
                {t}
                <button onClick={() => setTimes((arr) => arr.filter((x) => x !== t))} className="w-4 h-4 grid place-items-center rounded-full hover:bg-white/50 cursor-pointer">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <TextField type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1" />
            <Button variant="secondary" size="sm" onClick={addTime}>Add time</Button>
          </div>
        </div>

        <TextField label="Starts" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

        <Select label="Ends" value={endType} onChange={(e) => setEndType(e.target.value as RuleEndType)}>
          <option value="never">Never</option>
          <option value="keydate">On a litter key date</option>
          <option value="date">On a specific date</option>
          <option value="count">After N occurrences</option>
        </Select>
        {endType === 'keydate' && (
          <Select label="Key date" value={endKey} onChange={(e) => setEndKey(e.target.value)}>
            <option value="weaning">Weaning</option>
            <option value="handover">Handover</option>
            <option value="whelping">Whelping</option>
          </Select>
        )}
        {endType === 'date' && <TextField label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
        {endType === 'count' && <TextField label="Occurrences" type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value))} />}

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">ASSIGNEES (rotated)</div>
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

        {scope === 'litter' && activeLitter && (
          <div className="text-[11px] text-faint font-semibold bg-muted-bg rounded-[10px] px-3 py-2">
            Litter dates: whelping {effectiveDate(activeLitter.dates, 'whelping') ?? '—'} · weaning {effectiveDate(activeLitter.dates, 'weaning') ?? '—'}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function ScopeBtn({ active, disabled, onClick, label }: { active: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 rounded-[10px] border text-[12px] font-extrabold cursor-pointer disabled:opacity-40 ${active ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'}`}
    >
      {label}
    </button>
  );
}
