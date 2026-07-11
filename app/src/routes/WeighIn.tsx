import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, CollarAvatar, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { todayStr, diffDays } from '../lib/dates';
import { effectiveDate, hasWeightAlert } from '../lib/scheduling';
import { deltaVerdict, previousWeight, type DeltaTone } from '../lib/puppyDelta';
import { notifyMembers } from '../lib/actions';

const TONE: Record<DeltaTone, { bg: string; fg: string }> = {
  good: { bg: '#e3f1ea', fg: '#17805a' },
  watch: { bg: '#f7ecdc', fg: '#b97324' },
  bad: { bg: '#f6e6e3', fg: '#b93a2e' },
};

const QUICK = [35, 45, 55];

export default function WeighIn() {
  const { litters, activeLitterId, puppies, members, space } = useSpace();
  const navigate = useNavigate();
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies
    .filter((p) => p.litter_id === activeLitterId && p.status !== 'deceased')
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = todayStr();

  const [session, setSession] = useState<'am' | 'pm'>('am');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [alerted, setAlerted] = useState(false);

  // Reset optimistic saves + focus when the session (AM/PM) flips.
  useEffect(() => {
    setSaved({});
    setFocusId(null);
    setInput('');
    setAlerted(false);
  }, [session]);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  const whelping = effectiveDate(litter.dates, 'whelping');
  const ageDays = whelping ? diffDays(whelping, today) : null;

  const savedVal = (id: string): number | null => {
    if (saved[id] != null) return saved[id];
    const p = litterPuppies.find((x) => x.id === id);
    const v = p?.weigh_log[today]?.[session];
    return v != null ? v : null;
  };
  const isWeighed = (id: string) => savedVal(id) !== null;

  const total = litterPuppies.length;
  const doneCount = litterPuppies.filter((p) => isWeighed(p.id)).length;
  const allDone = total > 0 && doneCount === total;

  // Effective focus: explicit selection if still pending, else first unweighed.
  const focusPup =
    (focusId && litterPuppies.find((p) => p.id === focusId)) ||
    litterPuppies.find((p) => !isWeighed(p.id)) ||
    null;

  const prevWeight = focusPup ? previousWeight(focusPup.weigh_log, today, session) : null;
  const typed = input.trim() === '' ? null : Number(input);
  const verdict = typed != null && Number.isFinite(typed) ? deltaVerdict(typed, prevWeight) : null;
  const inputValid = typed != null && Number.isFinite(typed) && typed > 0;

  const sessionLabel = session === 'pm' ? 'Evening' : 'Morning';

  const saveFocused = async () => {
    if (!focusPup || !inputValid) return;
    setBusy(true);
    const grams = Math.round(typed!);
    const weigh_log = { ...focusPup.weigh_log, [today]: { ...focusPup.weigh_log[today], [session]: grams } };
    await supabase.from('puppies').update({ weigh_log }).eq('id', focusPup.id);
    setSaved((s) => ({ ...s, [focusPup.id]: grams }));
    // Advance to the next still-unweighed puppy (excluding the one just saved).
    const next = litterPuppies.find((p) => p.id !== focusPup.id && !isWeighed(p.id));
    setFocusId(next ? next.id : null);
    setInput('');
    setBusy(false);
  };

  const finish = async () => {
    // Fire the flat-gain alert once, as the old save-all did.
    if (!alerted && space) {
      const flat = litterPuppies.some((p) => {
        const g = saved[p.id];
        const log = g != null ? { ...p.weigh_log, [today]: { ...p.weigh_log[today], [session]: g } } : p.weigh_log;
        return hasWeightAlert(log);
      });
      if (flat) {
        await notifyMembers(
          space.id,
          members,
          'weight_alert',
          `${litter.name}: flat weight gain detected`,
          'Open the weigh-in log — a puppy has gained ≤5 g over 4 weigh-ins.',
          litter.id,
        );
      }
      setAlerted(true);
    }
    navigate('/');
  };

  // Average gain across puppies that have a previous reading to compare against.
  const gains = litterPuppies
    .map((p) => {
      const cur = savedVal(p.id);
      const prev = previousWeight(p.weigh_log, today, session);
      return cur != null && prev != null ? cur - prev : null;
    })
    .filter((g): g is number => g != null);
  const avgGain = gains.length ? Math.round(gains.reduce((a, b) => a + b, 0) / gains.length) : null;

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto pb-28">
      <PageHeader
        title={`${sessionLabel} weigh-in`}
        subtitle={`${litter.name}${ageDays != null && ageDays >= 0 ? ` · day ${ageDays}` : ''} · aim for +30–70 g`}
      />

      <div className="mb-4">
        <SegmentedControl
          value={session}
          onChange={setSession}
          options={[{ value: 'am', label: 'Morning' }, { value: 'pm', label: 'Evening' }]}
        />
      </div>

      {total === 0 ? (
        <EmptyState title="No puppies yet" subtitle="Puppies appear here once logged in the whelping birth log." />
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-[6px] rounded-full bg-chip-bg overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-[width]" style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
            <span className="text-[13px] font-extrabold text-muted tabular-nums flex-none">
              {doneCount} of {total}
              {doneCount === total - 1 && <span className="text-accent"> · almost there</span>}
            </span>
          </div>

          {allDone ? (
            <div className="rounded-[20px] p-6 text-white text-center" style={{ background: '#123f2d' }}>
              <div className="text-[18px] font-extrabold">All {total} weighed — nice work! 🎉</div>
              {avgGain != null && (
                <div className="text-[13px] font-semibold opacity-85 mt-1">
                  Average gain today: {avgGain >= 0 ? '+' : '−'}{Math.abs(avgGain)} g
                </div>
              )}
              <Button onClick={finish} disabled={busy} className="mt-4 w-full !bg-[#7fd4ae] !text-[#123f2d] hover:!bg-[#6ec79f]">
                Done — back home ✓
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {litterPuppies.map((p) => {
                const focused = focusPup?.id === p.id;
                const cur = savedVal(p.id);
                const weighed = cur !== null;
                const yst = previousWeight(p.weigh_log, today, session);

                if (focused) {
                  return (
                    <div key={p.id} className="rounded-[18px] border-2 border-accent bg-card p-4 shadow-[0_6px_20px_rgba(23,128,90,0.12)]">
                      <div className="flex items-center gap-3">
                        <CollarAvatar name={p.name} collar={p.collar_color} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[16px] font-extrabold truncate">
                            {p.name}
                            {p.collar_color && <span className="text-faint font-bold"> · {p.collar_color} collar</span>}
                          </div>
                          <div className="text-[12.5px] text-faint font-semibold truncate">
                            {p.sex === 'female' ? '♀' : p.sex === 'male' ? '♂' : '—'}
                            {yst != null ? ` · yesterday ${yst} g` : ' · first weigh-in'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <input
                          autoFocus
                          type="number"
                          inputMode="numeric"
                          placeholder={yst != null ? String(yst) : 'grams'}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveFocused(); }}
                          className="w-full text-[34px] font-extrabold px-3 py-1.5 rounded-[12px] border border-border bg-white text-ink placeholder:text-faint tabular-nums"
                        />
                        {verdict && (
                          <span className="flex-none px-3 py-2 rounded-full text-[13px] font-extrabold whitespace-nowrap" style={{ background: TONE[verdict.tone].bg, color: TONE[verdict.tone].fg }}>
                            {verdict.label}
                          </span>
                        )}
                      </div>

                      {yst != null && (
                        <div className="flex gap-2 mt-3">
                          {QUICK.map((d) => (
                            <button
                              key={d}
                              onClick={() => setInput(String(yst + d))}
                              className="flex-1 py-2 rounded-full text-[13px] font-extrabold bg-chip-bg text-muted hover:bg-accent-soft hover:text-accent cursor-pointer"
                            >
                              +{d} g
                            </button>
                          ))}
                        </div>
                      )}

                      {verdict?.tone === 'watch' || verdict?.tone === 'bad' ? (
                        <div className="text-[12px] font-semibold text-amber mt-2.5">Slow gain — worth a closer look today.</div>
                      ) : null}
                    </div>
                  );
                }

                // Unfocused rows.
                return (
                  <button
                    key={p.id}
                    onClick={() => { setFocusId(p.id); setInput(''); }}
                    className={`flex items-center gap-3 p-3 rounded-[14px] border border-card-border bg-card text-left cursor-pointer hover:border-border-strong ${weighed ? '' : 'opacity-85'}`}
                  >
                    <CollarAvatar name={p.name} collar={p.collar_color} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-extrabold truncate">{p.name}</div>
                      {weighed ? (
                        <div className="text-[12.5px] font-semibold text-faint">
                          {yst != null ? `${yst} → ` : ''}<span className="text-ink font-extrabold">{cur} g</span>
                        </div>
                      ) : (
                        <div className="text-[12.5px] font-semibold text-faint">{yst != null ? `yesterday ${yst} g` : 'first weigh-in'}</div>
                      )}
                    </div>
                    {weighed ? (() => {
                      const v = deltaVerdict(cur!, yst);
                      return v ? (
                        <span className="flex-none px-2.5 py-1 rounded-full text-[12px] font-extrabold" style={{ background: TONE[v.tone].bg, color: TONE[v.tone].fg }}>{v.label}</span>
                      ) : <span className="flex-none text-[12px] font-extrabold text-faint">saved</span>;
                    })() : (
                      <span className="flex-none px-2.5 py-1 rounded-full text-[12px] font-extrabold border border-dashed border-border text-faint">tap to weigh</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sticky save bar (hidden once all are weighed). */}
      {total > 0 && !allDone && focusPup && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-app-bg via-app-bg to-transparent px-4 pt-6 pb-4 sm:pb-6">
          <div className="max-w-xl mx-auto">
            <Button onClick={saveFocused} disabled={!inputValid || busy} className="w-full !min-h-14 !text-[15px]">
              {!inputValid
                ? `Enter ${focusPup.name}'s weight`
                : doneCount === total - 1
                ? `Save ${focusPup.name} · last one!`
                : `Save ${focusPup.name} · next puppy ›`}
            </Button>
            <div className="text-[11.5px] text-faint font-semibold text-center mt-2">
              Focus jumps to the next unweighed puppy automatically.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
