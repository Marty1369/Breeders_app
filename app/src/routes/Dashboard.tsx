import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Button, Card, EmptyState } from '../components/ui';
import { addDays, diffDays, niceDate, parseDate, todayStr } from '../lib/dates';
import { effectiveDate, hasWeightAlert } from '../lib/scheduling';
import { litterProgress } from '../lib/stages';
import { checkKey, occurrencesForDate } from '../lib/recurrence';
import type { Dog, Puppy, RuleCheck } from '../lib/types';

const CARD = 'bg-card border border-border rounded-[16px] p-4';

export default function Dashboard() {
  const {
    space, me, litters, tasks, puppies, dogs, owners, expenses, recurrenceRules, ruleChecks,
    activeLitterId, setActiveLitterId,
  } = useSpace();
  const navigate = useNavigate();

  const litter = litters.find((l) => l.id === activeLitterId) || null;
  const today = todayStr();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const checkMap = useMemo(() => {
    const m = new Map<string, RuleCheck>();
    for (const c of ruleChecks) m.set(checkKey(c.rule_id, c.occ_date, c.occ_time), c);
    return m;
  }, [ruleChecks]);

  if (litters.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Greeting greeting={greeting} me={me?.name} kennel={space?.kennel_name || space?.name} />
        <FirstRun />
      </div>
    );
  }

  const litterPuppies = puppies.filter((p) => p.litter_id === litter?.id && p.status !== 'deceased');
  const litterTasks = tasks.filter((t) => t.litter_id === litter?.id);
  const litterDates = litter?.dates ?? null;

  const whelping = litter ? effectiveDate(litter.dates, 'whelping') : null;
  const weaning = litter ? effectiveDate(litter.dates, 'weaning') : null;
  const handover = litter ? effectiveDate(litter.dates, 'handover') : null;
  const heat = litter ? effectiveDate(litter.dates, 'heat') : null;
  const vaccine = whelping ? addDays(whelping, 49) : null;

  const progress = litter ? litterProgress(litter, today) : null;
  let pct = 0;
  if (heat && handover) pct = Math.max(0, Math.min(100, (diffDays(heat, today) / (diffDays(heat, handover) || 1)) * 100));

  // Today = rule occurrences + tasks due today
  const todayOccs = litter ? occurrencesForDate(recurrenceRules, checkMap, today, litterDates, litter.id, today) : [];
  const todayTasks = litterTasks.filter((t) => t.start_date === today);
  const todayTotal = todayOccs.length + todayTasks.length;
  const todayDone = todayOccs.filter((o) => o.check?.status === 'done').length + todayTasks.filter((t) => t.status === 'done').length;
  const dashNext = [
    ...todayOccs.filter((o) => o.check?.status !== 'done').map((o) => ({ label: o.rule.name, time: o.time })),
    ...todayTasks.filter((t) => t.status !== 'done').map((t) => ({ label: t.name, time: '' })),
  ].slice(0, 3);

  // Weight alert
  const alertPuppy = litterPuppies.find((p) => hasWeightAlert(p.weigh_log));

  // Puppy stats
  const statusChips = countStatuses(litterPuppies);
  const avgGain = averageDailyGain(litterPuppies, whelping, today);

  // Money
  const spent = expenses.filter((e) => e.litter_id === litter?.id).reduce((s, e) => s + e.amount_eur, 0);
  const received = litterPuppies.reduce((s, p) => {
    const owner = owners.find((o) => o.id === p.owner_id);
    return s + (owner ? owner.payments.reduce((a, pay) => a + pay.amount, 0) : 0);
  }, 0);
  const costPerPup = litterPuppies.length ? Math.round(spent / litterPuppies.length) : 0;

  // Next heat (soonest predicted across dams)
  const nextHeatDog = dogs
    .filter((d) => d.sex === 'female' && !d.is_external && d.next_heat_predicted)
    .sort((a, b) => (a.next_heat_predicted! < b.next_heat_predicted! ? -1 : 1))[0] as Dog | undefined;
  const heatText = nextHeatDog
    ? `${nextHeatDog.name} — ~${niceDate(nextHeatDog.next_heat_predicted!)} (in ${diffDays(today, nextHeatDog.next_heat_predicted!)} days)`
    : 'No heats predicted yet';

  // Next 7 days agenda
  const week = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(today, i + 1);
    const occ = litter ? occurrencesForDate(recurrenceRules, checkMap, d, litterDates, litter.id, today) : [];
    const dayTasks = litterTasks.filter((t) => t.start_date === d);
    const names = [...new Set([...occ.map((o) => o.rule.name), ...dayTasks.map((t) => t.name)])];
    const count = occ.length + dayTasks.length;
    return { date: d, label: dowLabel(d), items: names.join(' · ') || '—', count };
  });

  const activeLitters = litters.filter((l) => l.is_active && l.status !== 'closed' && l.status !== 'did_not_take');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">
      <Greeting greeting={greeting} me={me?.name} kennel={space?.kennel_name || space?.name} />

      {activeLitters.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {activeLitters.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLitterId(l.id)}
              className={`flex-none px-3 py-1.5 rounded-full text-[12px] font-extrabold cursor-pointer whitespace-nowrap border ${
                l.id === activeLitterId ? 'bg-accent text-white border-accent' : 'bg-card text-muted border-border'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {!litter ? (
        <EmptyState title="No active litter" subtitle="Pick a litter from the switcher or start a new one." action={<Button onClick={() => navigate('/dogs?new_litter=1')}>＋ New litter</Button>} />
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {/* Hero */}
            <div className="rounded-[16px] p-4 text-white" style={{ background: '#123f2d' }}>
              <div className="text-[10px] font-extrabold tracking-wide opacity-75">
                {litter.name.toUpperCase()} · {dogName(dogs, litter.dam_id)} × {dogName(dogs, litter.sire_id)}
              </div>
              <div className="text-[20px] font-extrabold mt-1 leading-tight">{progress?.headline}</div>
              {progress?.detail && <div className="text-[12.5px] font-semibold opacity-80 mt-0.5">{progress.detail}</div>}
              <div className="mt-2.5 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7fd4ae' }} />
              </div>
              <div className="flex gap-3.5 mt-3 text-[11px] font-bold opacity-90 flex-wrap">
                {weaning && <span>Weaning · {niceDate(weaning)}</span>}
                {vaccine && <span>Vaccine #1 · {niceDate(vaccine)}</span>}
                {handover && <span>Handover · {niceDate(handover)}</span>}
              </div>
            </div>

            {/* Today */}
            <button className={`${CARD} text-left cursor-pointer`} onClick={() => navigate('/today')}>
              <CardHead label="TODAY" action="Open →" />
              <div className="text-[22px] font-extrabold mt-0.5">
                {todayDone} <span className="text-[13px] font-bold text-faint">of {todayTotal} done</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-2.5">
                {dashNext.length === 0 && <div className="text-[12px] text-faint font-semibold">All clear 🎉</div>}
                {dashNext.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-none" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {n.time && <span className="text-[10px] text-faint font-bold">{n.time}</span>}
                  </div>
                ))}
              </div>
            </button>

            {/* Weight alert */}
            {alertPuppy && (
              <button className="rounded-[16px] p-4 text-left cursor-pointer bg-card border-[1.5px]" style={{ borderColor: '#e5c9a3' }} onClick={() => navigate('/weigh-in')}>
                <div className="text-[11px] font-extrabold tracking-wide text-amber">Needs a look</div>
                <div className="text-[15px] font-extrabold mt-1">{alertPuppy.name} hasn't gained weight in 4 weigh-ins</div>
                <div className="text-[12px] text-faint font-semibold mt-0.5">Worth a closer look today</div>
                <span className="inline-block mt-2.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold" style={{ background: '#fbeee0', color: '#b97324' }}>Open weigh-ins →</span>
              </button>
            )}

            {/* Puppies */}
            <button className={`${CARD} text-left cursor-pointer`} onClick={() => navigate('/puppies')}>
              <CardHead label="PUPPIES" action="Open →" />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {statusChips.map((c) => (
                  <span key={c.label} className="px-2.5 py-1 rounded-full text-[11px] font-extrabold" style={{ background: c.bg, color: c.fg }}>{c.label}</span>
                ))}
                {statusChips.length === 0 && <span className="text-[12px] text-faint font-semibold">No puppies yet</span>}
              </div>
              <div className="text-[11px] text-faint font-semibold mt-2.5">Avg gain {avgGain} g/day · litter of {litterPuppies.length}</div>
            </button>

            {/* Money */}
            <button className={`${CARD} text-left cursor-pointer`} onClick={() => navigate('/expenses')}>
              <CardHead label="MONEY" action="Open →" />
              <div className="flex gap-4 mt-1.5">
                <Stat value={`€${spent}`} label="spent" />
                <Stat value={`€${received}`} label="received" accent />
                <Stat value={`€${costPerPup}`} label="cost / puppy" />
              </div>
            </button>

            {/* Next heat */}
            <button className={`${CARD} text-left cursor-pointer`} onClick={() => navigate('/dogs')}>
              <CardHead label="NEXT HEAT" action="My dogs →" />
              <div className="text-[14px] font-extrabold mt-1">{heatText}</div>
              <div className="text-[11px] text-faint font-semibold mt-0.5">heat-watch reminder 14 days before</div>
            </button>
          </div>

          {/* Next 7 days */}
          <div className="mt-5">
            <div className="text-[11px] font-extrabold tracking-wide text-faint mb-2 px-0.5">NEXT 7 DAYS</div>
            <div className="bg-card border border-border rounded-[14px] overflow-hidden">
              {week.map((d) => (
                <button key={d.date} onClick={() => navigate('/tasks')} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border-soft last:border-0 text-left hover:bg-muted-bg">
                  <div className="w-[74px] flex-none text-[11px] font-extrabold text-[#3a413d]">{d.label}</div>
                  <div className="flex-1 text-[12.5px] font-bold truncate">{d.items}</div>
                  <div className="flex-none text-[10px] text-faint font-bold">{d.count ? `${d.count} items` : ''}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {litter && (
        <button onClick={() => navigate('/dogs?new_litter=1')} className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-20 w-14 h-14 rounded-full bg-accent text-white text-[24px] font-bold grid place-items-center shadow-lg cursor-pointer">+</button>
      )}
    </div>
  );
}

function Greeting({ greeting, me, kennel }: { greeting: string; me?: string; kennel?: string }) {
  return (
    <div className="mb-5">
      <div className="text-[20px] font-extrabold">{greeting}{me ? `, ${me.split(' ')[0]}` : ''}</div>
      <div className="text-[12px] text-faint font-semibold mt-0.5">{kennel}</div>
    </div>
  );
}

function CardHead({ label, action }: { label: string; action: string }) {
  return (
    <div className="flex items-center">
      <div className="text-[10px] font-extrabold tracking-wide text-faint">{label}</div>
      <div className="flex-1" />
      <div className="text-[11px] font-extrabold text-accent">{action}</div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-[19px] font-extrabold ${accent ? 'text-accent' : ''}`}>{value}</div>
      <div className="text-[10px] text-faint font-bold">{label}</div>
    </div>
  );
}

function dogName(dogs: Dog[], id: string | null): string {
  return dogs.find((d) => d.id === id)?.name ?? '—';
}

function dowLabel(date: string): string {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseDate(date).getDay()];
  return `${dow}, ${niceDate(date)}`;
}

function countStatuses(pups: Puppy[]) {
  const order: { key: Puppy['status']; label: string; bg: string; fg: string }[] = [
    { key: 'available', label: 'available', bg: '#e3f1ea', fg: '#17805a' },
    { key: 'reserved', label: 'reserved', bg: '#f7ecdc', fg: '#b97324' },
    { key: 'coowned', label: 'coowned', bg: '#eef0ec', fg: '#6b7370' },
    { key: 'export', label: 'export', bg: '#e8eef7', fg: '#4a6fa5' },
  ];
  return order
    .map((o) => ({ ...o, n: pups.filter((p) => p.status === o.key).length }))
    .filter((o) => o.n > 0)
    .map((o) => ({ label: `${o.n} ${o.label}`, bg: o.bg, fg: o.fg }));
}

function averageDailyGain(pups: Puppy[], whelping: string | null, today: string): number {
  if (!pups.length || !whelping) return 0;
  const days = Math.max(1, diffDays(whelping, today));
  const gains = pups.map((p) => {
    const entries = Object.keys(p.weigh_log).sort();
    if (!entries.length || p.birth_weight == null) return 0;
    const last = p.weigh_log[entries[entries.length - 1]];
    const latest = last.pm ?? last.am ?? p.birth_weight;
    return (latest - p.birth_weight) / days;
  });
  return Math.round(gains.reduce((a, b) => a + b, 0) / gains.length);
}

function FirstRun() {
  const { space, members, dogs } = useSpace();
  const navigate = useNavigate();
  const inviteUrl = space ? `${window.location.origin}/join/${space.invite_token}` : '';
  const hasTeammates = members.length > 1;
  const hasDogs = dogs.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <EmptyState icon="🐾" title="Welcome to your kennel space" subtitle="Add your dogs, invite your team, then start your first litter — tasks, timeline, and documents are generated automatically." />
      <div className="flex flex-col sm:flex-row gap-3">
        <Card className="flex-1 p-4">
          <div className="text-[13px] font-extrabold mb-1">1. Invite your team</div>
          <div className="text-[11.5px] text-muted font-semibold mb-2.5">{hasTeammates ? 'Your team is set up.' : 'Share this link with people who help run the kennel.'}</div>
          {!hasTeammates && inviteUrl && <div className="text-[11px] font-semibold bg-muted-bg rounded-[8px] px-2.5 py-2 break-all">{inviteUrl}</div>}
        </Card>
        <Card className="flex-1 p-4">
          <div className="text-[13px] font-extrabold mb-1">2. Add your dogs</div>
          <div className="text-[11.5px] text-muted font-semibold mb-2.5">{hasDogs ? 'You have dogs on record.' : 'Add your dam and sire records first.'}</div>
          <Button variant="secondary" onClick={() => navigate('/dogs')}>Go to My dogs</Button>
        </Card>
        <Card className="flex-1 p-4">
          <div className="text-[13px] font-extrabold mb-1">3. Start first litter</div>
          <div className="text-[11.5px] text-muted font-semibold mb-2.5">Generates the full task plan automatically.</div>
          <Button onClick={() => navigate('/dogs?new_litter=1')} disabled={!hasDogs}>＋ New litter</Button>
        </Card>
      </div>
    </div>
  );
}
