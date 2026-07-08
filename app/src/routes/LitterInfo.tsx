import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, Chip, EmptyState, PageHeader, TextField } from '../components/ui';
import { longDate } from '../lib/dates';
import { applyDateChange, previewDateChange } from '../lib/actions';
import type { DateKey } from '../lib/scheduling';
import FailedPregnancySheet from '../components/task/FailedPregnancySheet';

const KEYS: { key: DateKey; label: string }[] = [
  { key: 'heat', label: 'Heat start' },
  { key: 'ovulation', label: 'Ovulation' },
  { key: 'mating', label: '2nd mating' },
  { key: 'whelping', label: 'Whelping' },
  { key: 'weaning', label: 'Weaning (8wk)' },
  { key: 'handover', label: 'Handover' },
];

export default function LitterInfo() {
  const { id } = useParams<{ id: string }>();
  const { litters, tasks, members, dogs } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === id);
  const [editingKey, setEditingKey] = useState<DateKey | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [preview, setPreview] = useState<{ key: DateKey; newDates: ReturnType<typeof previewDateChange>['newDates']; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [endPlanOpen, setEndPlanOpen] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="Litter not found" />
      </div>
    );
  }

  const dam = dogs.find((d) => d.id === litter.dam_id);
  const sire = dogs.find((d) => d.id === litter.sire_id);

  function startEdit(key: DateKey, current: string | null) {
    setEditingKey(key);
    setDraftValue(current || '');
  }

  function runPreview() {
    if (!editingKey || !litter) return;
    const { newDates, changed } = previewDateChange(litter, tasks, editingKey, draftValue || null);
    setPreview({ key: editingKey, newDates, count: changed.length });
  }

  async function confirmApply() {
    if (!preview || !litter) return;
    setBusy(true);
    await applyDateChange(litter, tasks, members, preview.newDates, user?.id);
    setBusy(false);
    setPreview(null);
    setEditingKey(null);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title={litter.name} subtitle={`${dam?.name ?? '—'} × ${sire?.name ?? '—'}`} action={<Chip>{litter.status.replace('_', ' ')}</Chip>} />

      <Card className="p-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">KEY DATES — AUTO (formula) vs MANUAL (wins)</div>
        <div className="flex flex-col gap-2.5">
          {KEYS.map(({ key, label }) => {
            const pair = litter.dates[key];
            return (
              <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-border-soft last:border-0">
                <div className="text-[12.5px] font-extrabold w-28 flex-none">{label}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-muted">
                    {pair?.predicted ? `Auto: ${longDate(pair.predicted)}` : 'Auto: —'}
                  </div>
                  {pair?.actual && (
                    <div className="text-[12px] font-extrabold text-accent">Manual: {longDate(pair.actual)}</div>
                  )}
                </div>
                <button onClick={() => startEdit(key, pair?.actual ?? null)} className="text-[11px] font-extrabold text-accent cursor-pointer flex-none">
                  {pair?.actual ? 'Edit' : 'Set manual'}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 mt-4">
        <Link to="/whelping"><Button variant="secondary">Birth log</Button></Link>
        <Link to="/weigh-in"><Button variant="secondary">Weigh-in</Button></Link>
        <Link to="/health-log"><Button variant="secondary">Health log</Button></Link>
        <Link to="/close-out"><Button variant="secondary">Close-out</Button></Link>
      </div>

      {litter.status !== 'closed' && litter.status !== 'did_not_take' && (
        <Button variant="danger" className="mt-4" onClick={() => setEndPlanOpen(true)}>
          End plan — did not take
        </Button>
      )}

      {editingKey && !preview && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/35" onClick={() => setEditingKey(null)} />
          <Card className="relative w-full sm:max-w-sm p-5">
            <div className="text-[14px] font-extrabold mb-3">{KEYS.find((k) => k.key === editingKey)?.label} — manual date</div>
            <TextField type="date" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
              <Button onClick={runPreview} disabled={!draftValue}>Preview cascade</Button>
            </div>
          </Card>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/35" onClick={() => setPreview(null)} />
          <Card className="relative w-full sm:max-w-sm p-5">
            <div className="text-[14px] font-extrabold mb-2">Confirm date change</div>
            <div className="text-[12.5px] font-semibold text-muted mb-4">
              {preview.count === 0
                ? 'No dependent tasks will move.'
                : `${preview.count} task date${preview.count === 1 ? '' : 's'} will re-shift to match.`}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={confirmApply} disabled={busy}>{busy ? 'Applying…' : 'Apply'}</Button>
            </div>
          </Card>
        </div>
      )}

      <FailedPregnancySheet litter={endPlanOpen ? litter : null} onClose={() => setEndPlanOpen(false)} />
    </div>
  );
}
