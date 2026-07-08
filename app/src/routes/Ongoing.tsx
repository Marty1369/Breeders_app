import { useMemo, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { supabase } from '../lib/supabase';
import { Avatar, Button, Card, Chip, EmptyState, PageHeader } from '../components/ui';
import { longDate, niceDate, todayStr } from '../lib/dates';
import { checkKey, occurrencesForDate, ruleEndDate } from '../lib/recurrence';
import { setOccurrence } from '../lib/actions';
import RuleFormSheet from '../components/RuleFormSheet';
import type { RecurrenceRule, RuleCheck } from '../lib/types';

function scheduleSummary(rule: RecurrenceRule): string {
  const freq =
    rule.freq === 'daily'
      ? rule.interval === 1 ? 'Daily' : `Every ${rule.interval} days`
      : rule.freq === 'weekly'
        ? rule.interval === 1 ? 'Weekly' : `Every ${rule.interval} weeks`
        : `Every ${rule.interval} days`;
  return `${freq} · ${rule.times.join(', ')}`;
}

export default function Ongoing() {
  const { recurrenceRules, ruleChecks, litters, activeLitterId, members, space } = useSpace();
  const { user } = useAuth();
  const [editRule, setEditRule] = useState<RecurrenceRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const today = todayStr();

  const activeLitter = litters.find((l) => l.id === activeLitterId) || null;
  const litterDates = activeLitter?.dates ?? null;

  const checkMap = useMemo(() => {
    const m = new Map<string, RuleCheck>();
    for (const c of ruleChecks) m.set(checkKey(c.rule_id, c.occ_date, c.occ_time), c);
    return m;
  }, [ruleChecks]);

  const visibleRules = useMemo(
    () =>
      recurrenceRules.filter(
        (r) => r.scope === 'kennel' || !r.litter_id || r.litter_id === activeLitterId
      ),
    [recurrenceRules, activeLitterId]
  );

  const todayOccurrences = useMemo(
    () => occurrencesForDate(recurrenceRules, checkMap, today, litterDates, activeLitterId, today),
    [recurrenceRules, checkMap, today, litterDates, activeLitterId]
  );

  async function togglePause(rule: RecurrenceRule) {
    await supabase.from('recurrence_rules').update({ paused: !rule.paused }).eq('id', rule.id);
  }

  function memberName(id: string | null) {
    if (!id) return null;
    return members.find((m) => m.user_id === id) ?? null;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Ongoing tasks"
        subtitle={activeLitter ? activeLitter.name : undefined}
        action={<Button icon="⟳" onClick={() => { setEditRule(null); setFormOpen(true); }}>New repeat</Button>}
      />

      {todayOccurrences.length > 0 && (
        <Card className="p-4 mb-5">
          <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">
            TODAY · {todayOccurrences.filter((o) => o.check?.status === 'done').length}/{todayOccurrences.length} done
          </div>
          <div className="flex flex-col gap-1.5">
            {todayOccurrences.map((o) => {
              const done = o.check?.status === 'done';
              const skip = o.check?.status === 'skip';
              const who = memberName(o.assigneeId);
              return (
                <div key={o.key} className="flex items-center gap-2.5 px-3 py-2 bg-app-bg border border-border-soft rounded-[10px]">
                  <button
                    onClick={() => setOccurrence(space!.id, o.rule.id, o.date, o.time, done ? null : 'done', user?.id)}
                    className={`w-[22px] h-[22px] flex-none rounded-[7px] grid place-items-center text-[12px] font-extrabold cursor-pointer border ${done ? 'bg-accent border-accent text-white' : 'bg-white border-border'}`}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12.5px] font-bold ${done ? 'line-through text-faint' : skip ? 'text-faint' : ''}`}>{o.rule.name}</div>
                    <div className="text-[10px] text-faint font-semibold">{o.time}{who ? ` · ${who.name}` : ''}</div>
                  </div>
                  {who && <Avatar name={who.name} color={who.avatar_color} size={22} />}
                  {!done && (
                    <button
                      onClick={() => setOccurrence(space!.id, o.rule.id, o.date, o.time, skip ? null : 'skip', user?.id)}
                      className="text-[10px] font-extrabold text-amber cursor-pointer"
                    >
                      {skip ? 'Unskip' : 'Skip'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">RULES</div>
      {visibleRules.length === 0 ? (
        <EmptyState
          title="No recurring tasks yet"
          subtitle="Recurring chores like weigh-ins and box temperature checks live here."
          action={<Button icon="⟳" onClick={() => { setEditRule(null); setFormOpen(true); }}>New repeat</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleRules.map((rule) => {
            const end = ruleEndDate(rule, litterDates);
            const assignees = members.filter((m) => rule.assignee_ids.includes(m.user_id));
            return (
              <Card key={rule.id} className={`p-3.5 ${rule.paused ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-extrabold">{rule.name}</span>
                      <Chip tone={rule.scope === 'kennel' ? 'amber' : 'default'}>{rule.scope === 'kennel' ? 'Kennel' : 'Litter'}</Chip>
                      {rule.paused && <Chip>Paused</Chip>}
                    </div>
                    <div className="text-[11px] text-muted font-semibold mt-0.5">{scheduleSummary(rule)}</div>
                    <div className="text-[10.5px] text-faint font-semibold mt-0.5">
                      From {niceDate(rule.start_date)}{end ? ` until ${niceDate(end)}` : ' · no end'}
                    </div>
                  </div>
                  <div className="flex -space-x-1.5 flex-none">
                    {assignees.slice(0, 4).map((m) => (
                      <Avatar key={m.user_id} name={m.name} color={m.avatar_color} size={22} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2.5">
                  <button onClick={() => togglePause(rule)} className="text-[11px] font-extrabold text-amber cursor-pointer">
                    {rule.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={() => { setEditRule(rule); setFormOpen(true); }} className="text-[11px] font-extrabold text-accent cursor-pointer">
                    Edit
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-[10.5px] text-faint font-semibold mt-4 text-center">Today is {longDate(today)}</div>

      <RuleFormSheet open={formOpen} rule={editRule} onClose={() => { setFormOpen(false); setEditRule(null); }} />
    </div>
  );
}
