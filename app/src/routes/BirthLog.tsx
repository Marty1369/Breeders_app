import { useEffect, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, Chip, EmptyState, PageHeader, Select, Sheet, TextField, safeColor } from '../components/ui';
import { longDate, todayStr } from '../lib/dates';
import { cascadePreview, recomputeLitterDates, setActualDate } from '../lib/scheduling';
import { startWhelping, logBirth, saveBirthDetails, finishWhelping } from '../lib/actions';
import type { BirthEvent } from '../lib/types';

function clockOf(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function elapsedSince(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h ${m} min in` : `${m} min in`;
}

export default function BirthLog() {
  const { litters, activeLitterId, tasks, members, puppies, whelpingSessions, birthEvents, recurrenceRules } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === activeLitterId);
  const [busy, setBusy] = useState(false);
  const [editEvent, setEditEvent] = useState<BirthEvent | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  const session = whelpingSessions.find((s) => s.litter_id === litter.id) || null;
  const events = birthEvents.filter((e) => e.litter_id === litter.id).slice().sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const litterPuppies = puppies.filter((p) => p.litter_id === litter.id);
  const born = events.filter((e) => e.type === 'born');
  const stillborn = events.filter((e) => e.type === 'stillborn');
  // Every delivery (live or stillborn) has a placenta to account for.
  const deliveries = born.length + stillborn.length;
  const placentas = events.filter((e) => e.placenta_passed === true).length;
  const retained = deliveries - placentas;
  const started = !!session?.started_at;
  const finished = !!session?.ended_at;

  // Finish preview (spec §6): the birth date to be set (earliest delivery) and
  // how many rearing tasks will shift when it cascades.
  const earliestDelivery = events.map((e) => e.born_at).filter((x): x is string => !!x).sort()[0] ?? null;
  const previewBirthDate = earliestDelivery ? earliestDelivery.slice(0, 10) : todayStr();
  const previewNewDates = recomputeLitterDates(setActualDate(litter.dates, 'whelping', previewBirthDate));
  const previewShift = cascadePreview(tasks.filter((t) => t.litter_id === litter.id), litter.dates, previewNewDates).length;

  const begin = async () => {
    setBusy(true);
    await startWhelping(litter, members, user?.id);
    setBusy(false);
  };
  const add = async (type: 'born' | 'stillborn') => {
    setBusy(true);
    await logBirth(litter, type);
    setBusy(false);
  };
  const finish = async () => {
    setBusy(true);
    await finishWhelping(litter, tasks, members, birthEvents, user?.id, recurrenceRules);
    setBusy(false);
  };

  const puppyNameFor = (e: BirthEvent) => litterPuppies.find((p) => p.id === e.puppy_id)?.name;

  return (
    <div className={`min-h-full ${started ? 'bg-[#12140f] text-white' : ''}`}>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {started ? (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7fd4ae] animate-pulse flex-none" />
              <div className="text-[22px] font-extrabold">Whelping night</div>
            </div>
            <div className="text-[12.5px] text-white/60 font-semibold mt-0.5">
              {litter.name} · started {clockOf(session?.started_at ?? null)}
              {!finished && session?.started_at ? ` · ${elapsedSince(session.started_at)}` : ''}
            </div>
          </div>
        ) : (
          <PageHeader title="Whelping night" subtitle={litter.name} />
        )}

        {!started ? (
          <Card className="p-5 text-center">
            <div className="text-[13px] font-bold text-muted mb-3">
              Opening the birth log lets your team know whelping has started. You can add details later —
              just tap “Puppy born” each time one arrives.
            </div>
            <Button onClick={begin} disabled={busy}>Start whelping</Button>
          </Card>
        ) : (
          <>
            <div className="rounded-[14px] px-4 py-3 mb-3 bg-white/10">
              <div className="text-[17px] font-extrabold">
                {born.length} born{stillborn.length > 0 ? ` · ${stillborn.length} stillborn` : ''}
              </div>
            </div>

            {retained > 0 && (
              <div className="mb-4 text-[12.5px] font-semibold rounded-[10px] px-3 py-2 bg-[#3a2a12] text-[#f2c879]">
                {retained} placenta{retained === 1 ? " hasn't" : "s haven't"} passed yet — keep watching.
              </div>
            )}

            {!finished && (
              <div className="flex gap-3 mb-5">
                <Button onClick={() => add('born')} disabled={busy} className="flex-1 !min-h-14 !text-[15px]">
                  ＋ Puppy born
                </Button>
                <Button variant="danger" onClick={() => add('stillborn')} disabled={busy} className="flex-1 !min-h-14 !text-[15px]">
                  Stillborn
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-5">
              {events.length === 0 && (
                <div className="text-[12px] text-white/50 font-semibold text-center py-3">
                  Tap “Puppy born” each time one arrives — stamp the time now, fill in the details when you get a moment.
                </div>
              )}
              {events
                .slice()
                .reverse()
                .map((e) => {
                  const name = puppyNameFor(e);
                  const summary = [
                    e.sex === 'female' ? '♀' : e.sex === 'male' ? '♂' : null,
                    e.weight_g ? `${e.weight_g} g` : null,
                    e.collar_color ? `${e.collar_color} collar` : null,
                    e.calcium_given ? 'calcium ✓' : null,
                  ].filter(Boolean).join(' · ');
                  const passed = e.placenta_passed === true;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setEditEvent(e)}
                      className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-[12px] px-3 py-2.5 text-left cursor-pointer"
                    >
                      <div
                        className="w-9 h-9 flex-none rounded-full grid place-items-center text-[12px] font-extrabold text-white"
                        style={{ boxShadow: `inset 0 0 0 3px ${safeColor(e.collar_color, 'rgba(255,255,255,0.3)')}` }}
                      >
                        {e.seq}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold truncate">
                          {e.type === 'stillborn' ? `Stillborn #${e.seq}` : name || `Puppy #${e.seq}`} · {clockOf(e.born_at)}
                        </div>
                        {summary && <div className="text-[11px] text-white/55 font-semibold truncate">{summary}</div>}
                      </div>
                      <span
                        className={`flex-none text-[10.5px] font-extrabold px-2 py-1 rounded-full ${passed ? 'bg-[#1e3a2a] text-[#7fd4ae]' : 'text-[#f2c879] border border-dashed border-[#f2c879]'}`}
                      >
                        {passed ? 'placenta ✓' : 'placenta?'}
                      </span>
                    </button>
                  );
                })}
            </div>

            {finished ? (
              <div className="text-center">
                <Chip tone="accent">Whelping complete</Chip>
                <div className="text-[10.5px] text-white/40 font-semibold mt-2">
                  Birth date set to {longDate((session?.ended_at ?? new Date().toISOString()).slice(0, 10))} · rearing tasks unlocked
                </div>
              </div>
            ) : (
              <>
                <Button onClick={() => setConfirmOpen(true)} disabled={busy || events.length === 0} variant="secondary" className="w-full !border-white !text-white">
                  Finish — set birth date &amp; unlock rearing tasks
                </Button>
                <div className="text-[10.5px] text-white/40 font-semibold text-center mt-2">
                  Sets birth date to tonight and re-plans the rearing tasks — you'll see a preview before anything changes.
                </div>
              </>
            )}
          </>
        )}

        {litter.status !== 'born' && !started && (
          <div className="mt-4">
            <Chip>Expected around the whelping date on Litter info</Chip>
          </div>
        )}
      </div>

      <BirthDetailSheet event={editEvent} puppyName={editEvent ? puppyNameFor(editEvent) : undefined} onClose={() => setEditEvent(null)} />

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Finish whelping?"
        subtitle={litter.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={async () => { setConfirmOpen(false); await finish(); }} disabled={busy}>
              {busy ? 'Finishing…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-ink">
          <div className="text-[13px] font-semibold">
            Birth date will be set to <span className="font-extrabold">{longDate(previewBirthDate)}</span> (the earliest delivery).
          </div>
          <div className="bg-app-bg border border-border-soft rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold">
            {previewShift > 0
              ? <><span className="font-extrabold">{previewShift}</span> rearing task{previewShift === 1 ? '' : 's'} will shift to line up with the real birth date.</>
              : 'No rearing tasks need to move.'}
          </div>
          <div className="text-[11.5px] text-faint font-semibold">Recurring care reminders re-anchor to the birth date too.</div>
        </div>
      </Sheet>
    </div>
  );
}

function BirthDetailSheet({ event, puppyName, onClose }: { event: BirthEvent | null; puppyName?: string; onClose: () => void }) {
  const [form, setForm] = useState({
    sex: '' as '' | 'male' | 'female',
    weight: '',
    color: '',
    collar: '',
    markings: '',
    dewclaws: '',
    palate: '' as '' | 'ok' | 'bad',
    placenta: false,
    calcium: false,
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event) return;
    setForm({
      sex: event.sex || '',
      weight: event.weight_g != null ? String(event.weight_g) : '',
      color: event.color || '',
      collar: event.collar_color || '',
      markings: event.markings || '',
      dewclaws: event.dewclaws || '',
      palate: event.palate_ok == null ? '' : event.palate_ok ? 'ok' : 'bad',
      placenta: event.placenta_passed === true,
      calcium: event.calcium_given === true,
      notes: event.notes || '',
    });
  }, [event]);

  if (!event) return null;

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const save = async () => {
    setBusy(true);
    await saveBirthDetails(event!, {
      sex: form.sex || null,
      weight_g: form.weight.trim() === '' ? null : Number(form.weight),
      color: form.color || null,
      collar_color: form.collar || null,
      markings: form.markings || null,
      dewclaws: form.dewclaws || null,
      palate_ok: form.palate === '' ? null : form.palate === 'ok',
      placenta_passed: form.placenta,
      calcium_given: form.calcium,
      notes: form.notes || null,
    });
    setBusy(false);
    onClose();
  };

  return (
    <Sheet
      open={!!event}
      onClose={onClose}
      title={event.type === 'stillborn' ? `Stillborn #${event.seq}` : puppyName || `Puppy #${event.seq}`}
      subtitle={clockOf(event.born_at)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sex" value={form.sex} onChange={(e) => set('sex', e.target.value as 'male' | 'female' | '')}>
            <option value="">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
          <TextField label="Weight (g)" type="number" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} />
          <TextField label="Collar color" value={form.collar} onChange={(e) => set('collar', e.target.value)} placeholder="e.g. RED" />
        </div>
        <TextField label="Markings (bruožai)" value={form.markings} onChange={(e) => set('markings', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Dewclaws (pirštai)" value={form.dewclaws} onChange={(e) => set('dewclaws', e.target.value)} />
          <Select label="Palate (gomurys)" value={form.palate} onChange={(e) => set('palate', e.target.value as '' | 'ok' | 'bad')}>
            <option value="">Not checked</option>
            <option value="ok">OK</option>
            <option value="bad">Cleft / issue</option>
          </Select>
        </div>
        <div className="flex flex-col gap-2 bg-app-bg border border-border-soft rounded-[10px] p-3 text-ink">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.placenta} onChange={(e) => set('placenta', e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
            <span className="text-[12.5px] font-bold">Placenta passed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.calcium} onChange={(e) => set('calcium', e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
            <span className="text-[12.5px] font-bold">Calcium given to dam</span>
          </label>
        </div>
        <TextField label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Sheet>
  );
}
