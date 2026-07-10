import { useEffect, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, Chip, EmptyState, PageHeader, Select, Sheet, TextField } from '../components/ui';
import { longDate } from '../lib/dates';
import { startWhelping, logBirth, saveBirthDetails, finishWhelping } from '../lib/actions';
import type { BirthEvent } from '../lib/types';

function clockOf(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function BirthLog() {
  const { litters, activeLitterId, tasks, members, puppies, whelpingSessions, birthEvents, recurrenceRules } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === activeLitterId);
  const [busy, setBusy] = useState(false);
  const [editEvent, setEditEvent] = useState<BirthEvent | null>(null);

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
  const placentas = born.filter((e) => e.placenta_passed === true).length;
  const retained = born.length - placentas;
  const started = !!session?.started_at;
  const finished = !!session?.ended_at;

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
        <PageHeader title="Whelping birth log" subtitle={litter.name} />

        {!started ? (
          <Card className="p-5 text-center">
            <div className="text-[13px] font-bold text-muted mb-3">
              Opening the birth log notifies your team that whelping has started.
            </div>
            <Button onClick={begin} disabled={busy}>Start whelping</Button>
          </Card>
        ) : (
          <>
            <div className="flex gap-3 mb-3">
              <Stat n={born.length} label="BORN" />
              <Stat n={stillborn.length} label="STILLBORN" />
              <Stat n={retained} label="PLACENTAS DUE" tone={retained > 0 ? 'warn' : 'ok'} />
            </div>

            {retained > 0 && (
              <div className="mb-4 text-[11.5px] font-semibold rounded-[10px] px-3 py-2 bg-[#3a2a12] text-[#f2c879]">
                {born.length} born · {placentas} placenta{placentas === 1 ? '' : 's'} recorded · {retained} not yet passed. Watch for retained placenta.
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
                    e.sex,
                    e.weight_g ? `${e.weight_g} g` : null,
                    e.collar_color,
                  ].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={e.id}
                      onClick={() => setEditEvent(e)}
                      className="flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 rounded-[10px] px-3 py-2.5 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-bold truncate">
                          {e.type === 'stillborn' ? `Stillborn #${e.seq}` : name || `Puppy #${e.seq}`}
                        </div>
                        {summary && <div className="text-[10.5px] text-white/55 font-semibold truncate">{summary}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        {e.calcium_given && <span title="Calcium given" className="text-[11px]">Ca</span>}
                        {e.placenta_passed && <span title="Placenta passed" className="text-[11px]">✓P</span>}
                        <span className="text-[11px] text-white/50 font-semibold">{clockOf(e.born_at)}</span>
                        <span className="text-white/40 text-[13px]">›</span>
                      </div>
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
                <Button onClick={finish} disabled={busy} variant="secondary" className="w-full !border-white !text-white">
                  Finish — set birth date &amp; unlock rearing tasks
                </Button>
                <div className="text-[10.5px] text-white/40 font-semibold text-center mt-2">
                  Sets the litter's actual birth date from the first live birth.
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
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-[#f2c879]' : 'text-white';
  return (
    <div className="flex-1 bg-white/10 rounded-[14px] p-3 text-center">
      <div className={`text-[22px] font-extrabold ${color}`}>{n}</div>
      <div className="text-[10px] font-extrabold text-white/60 tracking-wide">{label}</div>
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
