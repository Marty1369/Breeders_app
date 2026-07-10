import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import type {
  BirthEvent, Dog, DocumentRecord, Expense, HealthEntry, Litter, Notification, Owner, Payer, Puppy,
  RecurrenceRule, RuleCheck, Space, SpaceMember, Task, TaskTemplate, Upload, WhelpingSession,
} from '../lib/types';

function useTable<T extends { id: string }>(table: string, spaceId: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spaceId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from(table)
      .select('*')
      .eq('space_id', spaceId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error(`load ${table}`, error);
        setRows((data as T[]) || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`${table}-${spaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `space_id=eq.${spaceId}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as T;
              return prev.some((r) => r.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as T;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((r) => r.id !== old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, spaceId]);

  return { rows, setRows, loading };
}

interface SpaceContextValue {
  space: Space | null;
  members: SpaceMember[];
  me: SpaceMember | null;
  dogs: Dog[];
  litters: Litter[];
  taskTemplates: TaskTemplate[];
  tasks: Task[];
  puppies: Puppy[];
  owners: Owner[];
  healthEntries: HealthEntry[];
  payers: Payer[];
  expenses: Expense[];
  documents: DocumentRecord[];
  uploads: Upload[];
  recurrenceRules: RecurrenceRule[];
  ruleChecks: RuleCheck[];
  whelpingSessions: WhelpingSession[];
  birthEvents: BirthEvent[];
  notifications: Notification[];
  activeLitterId: string | null;
  setActiveLitterId: (id: string | null) => void;
  loading: boolean;
  hasSpace: boolean;
  reloadMembership: () => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipTick, setMembershipTick] = useState(0);
  const [activeLitterId, setActiveLitterIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSpace(null);
      setMembershipLoading(false);
      return;
    }
    let active = true;
    setMembershipLoading(true);
    (async () => {
      const { data: memberRow } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (!memberRow) {
        setSpace(null);
        setMembershipLoading(false);
        return;
      }
      const { data: spaceRow } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', memberRow.space_id)
        .single();
      if (!active) return;
      setSpace(spaceRow as Space);
      setMembershipLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, membershipTick]);

  const spaceId = space?.id ?? null;

  const { rows: members } = useTable<SpaceMember>('space_members', spaceId);
  const { rows: dogs } = useTable<Dog>('dogs', spaceId);
  const { rows: litters } = useTable<Litter>('litters', spaceId);
  const { rows: taskTemplates } = useTable<TaskTemplate>('task_templates', spaceId);
  const { rows: tasks } = useTable<Task>('tasks', spaceId);
  const { rows: puppies } = useTable<Puppy>('puppies', spaceId);
  const { rows: owners } = useTable<Owner>('owners', spaceId);
  const { rows: healthEntries } = useTable<HealthEntry>('health_entries', spaceId);
  const { rows: payers } = useTable<Payer>('payers', spaceId);
  const { rows: expenses } = useTable<Expense>('expenses', spaceId);
  const { rows: documents } = useTable<DocumentRecord>('documents', spaceId);
  const { rows: uploads } = useTable<Upload>('uploads', spaceId);
  const { rows: recurrenceRules } = useTable<RecurrenceRule>('recurrence_rules', spaceId);
  const { rows: ruleChecks } = useTable<RuleCheck>('rule_checks', spaceId);
  const { rows: whelpingSessions } = useTable<WhelpingSession>('whelping_sessions', spaceId);
  const { rows: birthEvents } = useTable<BirthEvent>('birth_events', spaceId);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let active = true;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('load notifications', error);
        setNotifications((data as Notification[]) || []);
      });
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Notification;
              return prev.some((r) => r.id === row.id) ? prev : [row, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Notification;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((r) => r.id !== old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const me = useMemo(() => members.find((m) => m.user_id === user?.id) ?? null, [members, user]);

  // Default "current" litter: most recent active (is_active, non-terminal) litter.
  // Re-picks if the current litter is deactivated or removed.
  useEffect(() => {
    const currentStillActive =
      activeLitterId && litters.some((l) => l.id === activeLitterId && l.is_active && l.status !== 'closed' && l.status !== 'did_not_take');
    if (currentStillActive) return;
    const active = litters.filter((l) => l.is_active && l.status !== 'closed' && l.status !== 'did_not_take');
    const pick = (active.length ? active : litters).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    setActiveLitterIdState(pick?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litters]);

  const value: SpaceContextValue = {
    space,
    members,
    me,
    dogs,
    litters,
    taskTemplates,
    tasks,
    puppies,
    owners,
    healthEntries,
    payers,
    expenses,
    documents,
    uploads,
    recurrenceRules,
    ruleChecks,
    whelpingSessions,
    birthEvents,
    notifications,
    activeLitterId,
    setActiveLitterId: setActiveLitterIdState,
    loading: membershipLoading,
    hasSpace: !!space,
    reloadMembership: () => setMembershipTick((t) => t + 1),
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace must be used within SpaceProvider');
  return ctx;
}
