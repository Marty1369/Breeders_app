// Mirrors supabase/migrations/0001_init.sql

export type DatePair = { predicted: string | null; actual: string | null };

export type LitterDates = Partial<
  Record<'heat' | 'ovulation' | 'mating' | 'whelping' | 'weaning' | 'handover', DatePair>
>;

export type LitterStatus = 'planned' | 'pregnant' | 'born' | 'closed' | 'did_not_take';
export type TaskPhase = 'prewhelp' | 't1_birth' | 't2_wean' | 't3_social';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type PuppyStatus = 'available' | 'reserved' | 'coowned' | 'export' | 'deceased';
export type DocType = 'sale_lt' | 'sale_en' | 'coown' | 'export' | 'mating';
export type DocStatus = 'draft' | 'ready' | 'sent' | 'signed' | 'submitted' | 'approved';
export type ExpenseCategory =
  | 'vet_tests' | 'travel' | 'food' | 'lodging' | 'mating' | 'documents' | 'supplies' | 'other';
export type NotificationKind =
  | 'assigned' | 'due' | 'overdue' | 'milestone' | 'comment' | 'weight_alert'
  | 'plan_shift' | 'invite_joined' | 'heat_watch' | 'whelping_started' | 'litter_cancelled';

export interface Space {
  id: string;
  name: string;
  kennel_name: string | null;
  affix: string | null;
  breeder_name: string | null;
  breeder_address: string | null;
  breeder_phone: string | null;
  breeder_email: string | null;
  invite_token: string;
  invite_token_expires_at: string;
  notif_rules: {
    due_hour: number;
    overdue_hour: number;
    milestone_days_before: number[];
    heat_watch_days_before: number;
  };
  created_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  role: string;
  notif_prefs: {
    push: boolean;
    email: boolean;
    assignments: boolean;
    milestones: boolean;
    teammatesTasks: boolean;
  };
  push_tokens: string[];
  created_at: string;
}

export interface GeneticTest {
  test: string;
  result: string;
  byParentage?: boolean;
}

export interface Dog {
  id: string;
  space_id: string;
  name: string;
  sex: 'male' | 'female';
  breed: string | null;
  dob: string | null;
  reg_no: string | null;
  chip_no: string | null;
  photos: string[];
  genetics: GeneticTest[];
  hips: string | null;
  is_external: boolean;
  external_owner: { name: string; phone: string; city: string } | null;
  heats: { startedAt: string }[];
  next_heat_predicted: string | null;
  status: string;
  created_at: string;
}

export interface Litter {
  id: string;
  space_id: string;
  code: string | null;
  name: string;
  letter: string | null;
  dam_id: string | null;
  sire_id: string | null;
  status: LitterStatus;
  is_active: boolean;
  dates: LitterDates;
  whelping_log: { ts: string; type: 'born' | 'stillborn'; puppyId?: string; note?: string }[];
  created_at: string;
}

export type DepType = 'FS' | 'SS';
/** On a task: predecessor is another task id. */
export interface TaskDep {
  taskId: string;
  type: DepType;
  lag: number;
}
/** On a template: predecessor is referenced by its sort_order. */
export interface TemplateDep {
  ref: number;
  type: DepType;
  lag: number;
}

export interface TaskTemplate {
  id: string;
  space_id: string;
  name: string;
  phase: TaskPhase;
  anchor: 'heat' | 'ovulation' | 'mating' | 'whelping' | 'handover';
  offset_days: number;
  duration_days: number;
  repeat: { every: number; count: number } | null;
  depends_on: TemplateDep[];
  sort_order: number;
  created_at: string;
}

export interface TaskComment {
  ts: string;
  byUserId: string;
  text: string;
}

export interface Task {
  id: string;
  space_id: string;
  litter_id: string;
  template_id: string | null;
  name: string;
  phase: TaskPhase;
  start_date: string;
  due_date: string | null;
  status: TaskStatus;
  assignee_ids: string[];
  is_pinned_date: boolean;
  anchor_mode: 'fixed' | 'anchor+offset';
  anchor: 'heat' | 'ovulation' | 'mating' | 'whelping' | 'handover' | null;
  offset_days: number | null;
  duration_days: number;
  depends_on: TaskDep[];
  notes: string | null;
  comments: TaskComment[];
  checklist: { label: string; done: boolean }[];
  cost_expected: boolean;
  result_log: { type: 'progesterone' | 'weight' | 'ultrasound' | 'note'; value: string; unit?: string } | null;
  created_at: string;
}

export interface Puppy {
  id: string;
  space_id: string;
  litter_id: string;
  name: string;
  litter_affix: string | null;
  sex: 'male' | 'female' | null;
  color: string | null;
  birth_date_time: string | null;
  birth_weight: number | null;
  chip_no: string | null;
  reg_no: string | null;
  photos: string[];
  genetics: GeneticTest[];
  weigh_log: Record<string, { am?: number; pm?: number }>;
  status: PuppyStatus;
  handover: {
    contractSigned: boolean;
    paymentComplete: boolean;
    chipRegistered: boolean;
    passportGiven: boolean;
    handedOverAt?: string;
  };
  owner_id: string | null;
  created_at: string;
}

export interface OwnerPayment {
  amount: number;
  date: string;
  kind: 'deposit' | 'final';
  method?: string;
}

export interface Owner {
  id: string;
  space_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  payments: OwnerPayment[];
  full_price: number;
  handover_date: string | null;
  notes: string | null;
  waiting_list_for: string | null;
  data_source: 'manual' | 'link';
  link_filled_at: string | null;
  created_at: string;
}

export interface HealthEntry {
  id: string;
  space_id: string;
  litter_id: string;
  type: 'vaccination' | 'deworming' | 'vet_check';
  product: string | null;
  date: string;
  applies_to: 'all' | string[];
  by_user_id: string | null;
  created_at: string;
}

export interface Payer {
  id: string;
  space_id: string;
  label: string;
  owner_user_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  space_id: string;
  litter_id: string | null;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount_eur: number;
  payer_id: string | null;
  receipt_photo: string | null;
  task_id: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  space_id: string;
  litter_id: string | null;
  puppy_id: string | null;
  type: DocType;
  field_values: Record<string, string>;
  missing_fields: string[];
  status: DocStatus;
  history: { ts: string; event: string; byUserId: string }[];
  pdf_url: string | null;
  created_at: string;
}

export interface Upload {
  id: string;
  space_id: string;
  litter_id: string | null;
  puppy_id: string | null;
  owner_id: string | null;
  file: string;
  name: string;
  mime_type: string | null;
  by_user_id: string | null;
  task_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  space_id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  ref_id: string | null;
  ref_type: string | null;
  read_at: string | null;
  created_at: string;
}

// --- Recurrence (0002_recurrence.sql) ---

export type RuleScope = 'kennel' | 'litter';
export type RuleFreq = 'daily' | 'weekly' | 'everyN';
export type RuleEndType = 'never' | 'date' | 'keydate' | 'count';

export interface RecurrenceRule {
  id: string;
  space_id: string;
  litter_id: string | null;
  name: string;
  scope: RuleScope;
  freq: RuleFreq;
  interval: number;
  times: string[]; // ['08:00','20:00']
  start_date: string;
  end_type: RuleEndType;
  end_key: string | null;
  end_date: string | null;
  end_count: number | null;
  assignee_ids: string[];
  paused: boolean;
  created_at: string;
}

export interface RuleCheck {
  id: string;
  space_id: string;
  rule_id: string;
  occ_date: string;
  occ_time: string;
  status: 'done' | 'skip';
  done_by: string | null;
  done_at: string | null;
  created_at: string;
}
