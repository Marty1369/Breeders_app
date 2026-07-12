import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, CircleCheckbox, EmptyState, safeColor } from '../components/ui';
import { ScaleIcon } from '../components/icons';
import { addDays, diffDays, niceDate, parseDate, todayStr } from '../lib/dates';
import { effectiveDate, hasWeightAlert } from '../lib/scheduling';
import { litterProgress } from '../lib/stages';
import { checkKey, occurrencesForDate, type Occurrence } from '../lib/recurrence';
import { markTaskDone, setOccurrence } from '../lib/actions';
import JourneyRibbon, { type Stop } from '../components/JourneyRibbon';
import type { Dog, Puppy, RuleCheck } from '../lib/types';

// Home = the one daily surface (spec §3): merges the old Today + Dashboard.
// The journey ribbon (§3.2) lands in P3.

const isWeighItem = (name: string) => /weigh/i.test(name);

export default function Home() {
  const {
    space, me, members, litters, tasks, puppies, dogs, owners, expenses, recurrenceRules, ruleChecks,
    activeLitterId, setActiveLitterId,
  } = useSpace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const checkMap = useMemo(() => {
    const m = new Map<string, RuleCheck>();
    for (const c of ruleChecks) m.set(checkKey(c.rule_id, c.occ_date, c.occ_time), c);
    return m;
  }, [ruleChecks]);

  const litter = litters.find((l) => l.id === activeLitterId) || null;
  const litterDates = litter?.dates ?? null;

  const whelping = litter ? effectiveDate(litter.dates, 'whelping') : null;
  const weaning = litter ? effectiveDate(litter.dates, 'weaning') : null;
  const handover = litter ? effectiveDate(litter.dates, 'handover') : null;
  const vaccine = whelping ? addDays(whelping, 49) : null;
  const progress = litter ? litterProgress(litter, today) : null;

  const todayOccs = litter ? occurrencesForDate(recurrenceRules, checkMap, today, litterDates, litter.id, today) : [];
  const todayTasks = litter ? tasks.filter((t) => t.litter_id === litter.id && t.start_date === today) : [];
  const total = todayOccs.length + todayTasks.length;
  const doneCount =
    todayOccs.filter((o) => o.check?.status === 'done').length + todayTasks.filter((t) => t.status === 'done').length;

  const openOccs = todayOccs.filter((o) => o.check?.status !== 'done');
  const openTasks = todayTasks.filter((t) => t.status !== 'done');
  const allDone = total > 0 && openOccs.length === 0 && openTasks.length === 0;

  const litterPuppies = puppies.filter((p) => p.litter_id === litter?.id && p.status !== 'deceased');
  const alertPuppy = litterPuppies.find((p) => hasWeightAlert(p.weigh_log));

  const dogName = (id: string | null) => dogs.find((d: Dog) => d.id === id)?.name ?? '—';

  const spent = expenses.filter((e) => e.litter_id === litter?.id).reduce((s, e) => s + e.amount_eur, 0);
  // Dedupe owners: one buyer reserving two pups must not have their payments counted twice.
  const litterOwnerIds = [...new Set(litterPuppies.map((p) => p.owner_id).filter((id): id is string => !!id))];
  const received = litterOwnerIds.reduce((s, oid) => {
    const owner = owners.find((o) => o.id === oid);
    return s + (owner ? owner.payments.reduce((a, pay) => a + pay.amount, 0) : 0);
  }, 0);

  const nextHeatDog = dogs
    .filter((d) => d.sex === 'female' && !d.is_external && d.next_heat_predicted)
    .sort((a, b) => (a.next_heat_predicted! < b.next_heat_predicted! ? -1 : 1))[0] as Dog | undefined;

  // Coming up: next few dated items after today.
  const coming = Array.from({ length: 7 })
    .map((_, i) => {
      const d = addDays(today, i + 1);
      const occ = litter ? occurrencesForDate(recurrenceRules, checkMap, d, litterDates, litter.id, today) : [];
      const dayTasks = litter ? tasks.filter((t) => t.litter_id === litter.id && t.start_date === d) : [];
      const names = [...new Set([...occ.map((o) => o.rule.name), ...dayTasks.map((t) => t.name)])];
      return { date: d, names, count: occ.length + dayTasks.length };
    })
    .filter((d) => d.count > 0)
    .slice(0, 3);

  const activeLitters = litters.filter((l) => l.is_active && l.status !== 'closed' && l.status !== 'did_not_take');

  const toggleOcc = (o: Occurrence) =>
    setOccurrence(space!.id, o.rule.id, o.date, o.time, o.check?.status === 'done' ? null : 'done', user?.id);

  if (litters.length === 0) {
    const hasDogs = dogs.length > 0;
    const hasTeam = members.length > 1;
    const setupStops: Stop[] = [
      { label: 'Your dogs', state: hasDogs ? 'done' : 'current' },
      { label: 'Your team', state: hasTeam ? 'done' : hasDogs ? 'current' : 'future' },
      { label: 'First litter', state: 'future' },
    ];
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="text-[22px] font-extrabold">{greeting}{me ? `, ${me.name.split(' ')[0]}` : ''}</div>
        <div className="text-[12.5px] text-faint font-semibold mt-0.5 mb-5">{space?.kennel_name || space?.name}</div>
        <div className="mb-5"><JourneyRibbon stops={setupStops} variant="light" /></div>
        <Card className="p-4">
          <div className="text-[11px] font-extrabold tracking-wide text-faint mb-2">UP NEXT</div>
          <div className="text-[16px] font-extrabold">{hasDogs ? 'Start your first litter' : 'Add your first dog'}</div>
          <div className="text-[12.5px] text-faint font-semibold mt-0.5">
            {hasDogs
              ? "Pick the mum and her heat date — we'll plan every task and date automatically."
              : 'Just name & sex — 30 seconds. Then start a litter from her.'}
          </div>
          <Button onClick={() => navigate(hasDogs ? '/litters/new' : '/dogs')} className="w-full mt-3">
            {hasDogs ? 'New litter' : 'Add'}
          </Button>
        </Card>
        {!hasTeam && (
          <div className="text-[12px] text-faint font-semibold mt-3 text-center">
            You can invite teammates any time from Kennel → Team.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <h1 className="sr-only">Home — today's plan for {litter ? litter.name : space?.kennel_name || 'your kennel'}</h1>
      {/* Dark header */}
      <div className="text-white px-4 sm:px-6 pt-5 pb-8" style={{ background: '#123f2d' }}>
        <div className="text-[11px] font-extrabold tracking-wide opacity-75">{greeting}{me ? `, ${me.name.split(' ')[0]}` : ''}</div>
        {litter ? (
          <>
            <div className="text-[12.5px] font-bold opacity-80 mt-1">
              {litter.name} · {dogName(litter.dam_id)} × {dogName(litter.sire_id)}
            </div>
            <div className="text-[22px] font-extrabold mt-0.5 leading-tight">{progress?.headline}</div>
            <div className="mt-4 mb-1"><JourneyRibbon litter={litter} variant="dark" /></div>
            {progress?.detail && <div className="text-[13px] font-semibold opacity-85 mt-1">{progress.detail}</div>}
            <div className="flex gap-3 mt-3 text-[11.5px] font-bold opacity-90 flex-wrap">
              {weaning && <span>Weaning · {niceDate(weaning)}</span>}
              {vaccine && <span>Vaccine #1 · {niceDate(vaccine)}</span>}
              {handover && <span>Home day · {niceDate(handover)}</span>}
            </div>
          </>
        ) : (
          <div className="text-[20px] font-extrabold mt-1">No litter selected</div>
        )}
        {activeLitters.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mt-3 pb-0.5">
            {activeLitters.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLitterId(l.id)}
                className={`flex-none px-3 py-1 rounded-full text-[12px] font-extrabold cursor-pointer whitespace-nowrap ${
                  l.id === activeLitterId ? 'bg-white text-[#123f2d]' : 'bg-white/15 text-white'
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Light sheet */}
      <div className="bg-app-bg rounded-t-[24px] -mt-5 relative px-4 sm:px-6 pt-5 flex flex-col gap-4">
        {!litter ? (
          <EmptyState title="Pick a litter" subtitle="Choose a litter from the switcher to see today's plan." />
        ) : (
          <>
            {/* UP NEXT */}
            {total === 0 ? (
              <Card className="p-5 text-center">
                <div className="text-[15px] font-extrabold">Nothing scheduled today</div>
                <div className="text-[12.5px] text-faint font-semibold mt-1">Enjoy the quiet — the plan picks back up soon.</div>
              </Card>
            ) : allDone ? (
              <div className="rounded-[18px] p-5 text-white" style={{ background: '#123f2d' }}>
                <div className="text-[16px] font-extrabold">Everything's done for today 🎉</div>
                <div className="text-[12.5px] font-semibold opacity-80 mt-1">Nice work — check back tomorrow.</div>
              </div>
            ) : (() => {
              const occ = openOccs[0];
              const task = !occ ? openTasks[0] : null;
              const name = occ ? occ.rule.name : task?.name ?? '';
              const sub = occ ? (occ.time ? `${occ.time}` : 'Anytime today') : 'One-off task';
              const weigh = isWeighItem(name);
              return (
                <Card className="p-4">
                  <div className="text-[11px] font-extrabold tracking-wide text-faint mb-2">UP NEXT</div>
                  <div className="flex items-center gap-3">
                    <div className="w-[54px] h-[54px] flex-none rounded-[14px] grid place-items-center text-white" style={{ background: weigh ? '#4a6fa5' : '#17805a' }}>
                      {weigh ? <ScaleIcon size={24} /> : <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-extrabold leading-tight">{name}</div>
                      <div className="text-[12.5px] text-faint font-semibold mt-0.5">{sub}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    {weigh ? (
                      <Button onClick={() => navigate('/weigh-in')} className="w-full">Start</Button>
                    ) : (
                      <Button
                        onClick={() => (occ ? toggleOcc(occ) : task && markTaskDone(task, true))}
                        className="w-full"
                      >
                        Done ✓
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })()}

            {/* TODAY checklist */}
            {total > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-[13px] font-extrabold flex-1">Today</div>
                  <div className="text-[12px] font-extrabold text-faint tabular-nums">{doneCount}/{total}</div>
                </div>
                <div className="h-[5px] rounded-full bg-chip-bg overflow-hidden mb-3">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
                </div>
                <div className="flex flex-col">
                  {todayOccs.map((o) => (
                    <CheckRow
                      key={o.key}
                      done={o.check?.status === 'done'}
                      name={o.rule.name}
                      meta={o.time || 'Anytime'}
                      onToggle={() => toggleOcc(o)}
                    />
                  ))}
                  {todayTasks.map((t) => (
                    <CheckRow
                      key={t.id}
                      done={t.status === 'done'}
                      name={t.name}
                      meta="task"
                      onToggle={() => markTaskDone(t, t.status !== 'done')}
                      onOpen={() => navigate('/plan')}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Weight alert */}
            {alertPuppy && (
              <button onClick={() => navigate('/weigh-in')} className="rounded-[16px] p-4 text-left cursor-pointer" style={{ background: '#fbeee0' }}>
                <div className="text-[15px] font-extrabold text-[#7a4a12]">{alertPuppy.name} hasn't gained weight in 4 weigh-ins</div>
                <div className="text-[12px] font-semibold text-[#9a6a2a] mt-0.5">Worth a closer look today · Chart →</div>
              </button>
            )}

            {/* Cards grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              <button onClick={() => navigate('/puppies')} className="bg-card border border-border rounded-[16px] p-4 text-left cursor-pointer">
                <div className="text-[11px] font-extrabold tracking-wide text-faint">Puppies</div>
                <div className="flex -space-x-1.5 mt-2">
                  {litterPuppies.slice(0, 6).map((p) => (
                    <CollarDot key={p.id} collar={p.collar_color} />
                  ))}
                  {litterPuppies.length === 0 && <span className="text-[12px] text-faint font-semibold">No puppies yet</span>}
                </div>
                {litterPuppies.length > 0 && (
                  <div className="text-[11.5px] text-faint font-semibold mt-2">
                    {litterPuppies.length} pup{litterPuppies.length === 1 ? '' : 's'} · {countAvailable(litterPuppies)} available
                  </div>
                )}
              </button>
              <button onClick={() => navigate('/expenses')} className="bg-card border border-border rounded-[16px] p-4 text-left cursor-pointer">
                <div className="text-[11px] font-extrabold tracking-wide text-faint">Money</div>
                <div className="text-[16px] font-extrabold mt-1">€{Math.round(received)} in · €{Math.round(spent)} out</div>
                <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-chip-bg">
                  <div style={{ width: `${barPct(received, spent)}%`, background: '#17805a' }} />
                  <div style={{ width: `${100 - barPct(received, spent)}%`, background: '#d9a05c' }} />
                </div>
              </button>
              {nextHeatDog && (
                <button onClick={() => navigate('/dogs')} className="bg-card border border-border rounded-[16px] p-4 text-left cursor-pointer">
                  <div className="text-[11px] font-extrabold tracking-wide text-faint">Next heat</div>
                  <div className="text-[13.5px] font-extrabold mt-1 leading-tight">{nextHeatDog.name}</div>
                  <div className="text-[11.5px] text-faint font-semibold mt-0.5">
                    ~{niceDate(nextHeatDog.next_heat_predicted!)} · in {diffDays(today, nextHeatDog.next_heat_predicted!)} days
                  </div>
                </button>
              )}
            </div>

            {/* Coming up */}
            {coming.length > 0 && (
              <div>
                <div className="text-[13px] font-extrabold mb-2">Coming up</div>
                <div className="bg-card border border-border rounded-[14px] overflow-hidden">
                  {coming.map((d) => (
                    <button key={d.date} onClick={() => navigate('/plan')} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border-soft last:border-0 text-left hover:bg-muted-bg">
                      <div className="w-[64px] flex-none text-[11.5px] font-extrabold text-[#3a413d]">{dowShort(d.date)}</div>
                      <div className="flex-1 text-[13px] font-bold truncate">{d.names.join(' · ')}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CheckRow({ done, name, meta, onToggle, onOpen }: { done: boolean; name: string; meta: string; onToggle: () => void; onOpen?: () => void }) {
  return (
    <div className="flex items-center gap-3 min-h-[52px] py-1">
      <CircleCheckbox checked={done} size={28} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={done ? `Uncheck ${name}` : `Check ${name}`} />
      <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={onOpen}>
        <div className={`text-[15px] font-bold truncate ${done ? 'line-through text-faint' : ''}`}>{name}</div>
        <div className="text-[12px] text-faint font-semibold">{meta}</div>
      </button>
    </div>
  );
}

function CollarDot({ collar }: { collar: string | null }) {
  return <span aria-hidden="true" className="w-6 h-6 rounded-full bg-white border-2 border-card" style={{ boxShadow: `inset 0 0 0 3px ${safeColor(collar)}` }} />;
}

function countAvailable(pups: Puppy[]): number {
  return pups.filter((p) => p.status === 'available').length;
}

function barPct(inAmt: number, outAmt: number): number {
  const t = inAmt + outAmt;
  return t <= 0 ? 50 : Math.round((inAmt / t) * 100);
}

function dowShort(date: string): string {
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parseDate(date).getDay()];
  return `${dow} ${niceDate(date).split(' ')[1]}`;
}
