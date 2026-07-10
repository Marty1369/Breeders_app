import { useState } from 'react';
import { useSpace } from '../../state/SpaceProvider';
import { useAuth } from '../../state/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Button, Select, Sheet, TextField } from '../ui';
import { completeTaskWithResult } from '../../lib/actions';
import { todayStr } from '../../lib/dates';
import type { ExpenseCategory, Task } from '../../lib/types';
import FailedPregnancySheet from './FailedPregnancySheet';

type ResultType = 'none' | 'progesterone' | 'ultrasound' | 'weight' | 'note';

const CATS: { value: ExpenseCategory; label: string }[] = [
  { value: 'vet_tests', label: 'Vet & tests' },
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'mating', label: 'Mating' },
  { value: 'documents', label: 'Documents' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other', label: 'Other' },
];

export default function CompleteTaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { litters, tasks, members, payers, space, recurrenceRules } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === task?.litter_id);

  const [resultType, setResultType] = useState<ResultType>('none');
  const [value, setValue] = useState('');
  const [progUnit, setProgUnit] = useState<'nmol/l' | 'ng/ml'>('nmol/l');
  const [testDate, setTestDate] = useState(todayStr());
  const [ultrasoundResult, setUltrasoundResult] = useState<'pregnant' | 'not_pregnant' | ''>('');
  const [attachExpense, setAttachExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCat, setExpCat] = useState<ExpenseCategory>('vet_tests');
  const [expPayer, setExpPayer] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmEndPlan, setConfirmEndPlan] = useState(false);

  function reset() {
    setResultType('none');
    setValue('');
    setUltrasoundResult('');
    setAttachExpense(false);
    setExpAmount('');
    setExpDesc('');
  }

  async function save() {
    if (!task) return;
    setBusy(true);

    let resultLog: Task['result_log'] = null;
    if (resultType === 'progesterone') resultLog = { type: 'progesterone', value, unit: progUnit, date: testDate };
    else if (resultType === 'ultrasound') resultLog = { type: 'ultrasound', value: ultrasoundResult || 'unknown' };
    else if (resultType === 'weight') resultLog = { type: 'weight', value, unit: 'g' };
    else if (resultType === 'note') resultLog = { type: 'note', value };

    await completeTaskWithResult(task, resultLog, litter, tasks, members, user?.id, recurrenceRules);

    if (attachExpense && space && expAmount) {
      await supabase.from('expenses').insert({
        space_id: space.id,
        litter_id: task.litter_id,
        date: todayStr(),
        description: expDesc || task.name,
        category: expCat,
        amount_eur: Number(expAmount),
        payer_id: expPayer || null,
        task_id: task.id,
      });
    }

    setBusy(false);

    if (resultType === 'ultrasound' && ultrasoundResult === 'not_pregnant') {
      setConfirmEndPlan(true);
      return;
    }
    reset();
    onClose();
  }

  return (
    <>
      <Sheet
        open={!!task && !confirmEndPlan}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Complete task"
        subtitle={task?.name}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Mark done'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select label="Log a result (optional)" value={resultType} onChange={(e) => setResultType(e.target.value as ResultType)}>
            <option value="none">No result to log</option>
            <option value="progesterone">Progesterone test</option>
            <option value="ultrasound">Ultrasound</option>
            <option value="weight">Weight</option>
            <option value="note">Note</option>
          </Select>

          {resultType === 'progesterone' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
                <Select label="Unit" value={progUnit} onChange={(e) => setProgUnit(e.target.value as 'nmol/l' | 'ng/ml')}>
                  <option value="nmol/l">nmol/L</option>
                  <option value="ng/ml">ng/mL</option>
                </Select>
              </div>
              <TextField label="Test date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
              {(progUnit === 'ng/ml' ? Number(value) * 3.18 : Number(value)) >= 18 && (
                <div className="text-[11.5px] font-bold text-accent bg-accent-soft rounded-[10px] px-3 py-2">
                  ≥ 18 nmol/L (≈ 5.7 ng/mL) confirms ovulation on {testDate} — saving will re-cascade dependent dates.
                </div>
              )}
            </>
          )}

          {resultType === 'ultrasound' && (
            <div className="flex gap-2">
              <button
                onClick={() => setUltrasoundResult('pregnant')}
                className={`flex-1 py-2.5 rounded-[10px] border text-[12.5px] font-extrabold cursor-pointer ${ultrasoundResult === 'pregnant' ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'}`}
              >
                Pregnant
              </button>
              <button
                onClick={() => setUltrasoundResult('not_pregnant')}
                className={`flex-1 py-2.5 rounded-[10px] border text-[12.5px] font-extrabold cursor-pointer ${ultrasoundResult === 'not_pregnant' ? 'border-danger bg-danger-soft text-danger' : 'border-border text-muted'}`}
              >
                Not pregnant
              </button>
            </div>
          )}

          {resultType === 'weight' && <TextField label="Weight (g)" type="number" value={value} onChange={(e) => setValue(e.target.value)} />}
          {resultType === 'note' && <TextField label="Note" value={value} onChange={(e) => setValue(e.target.value)} />}

          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input type="checkbox" checked={attachExpense} onChange={(e) => setAttachExpense(e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
            <span className="text-[12.5px] font-bold">Attach an expense</span>
          </label>

          {attachExpense && (
            <div className="flex flex-col gap-3 bg-app-bg border border-border-soft rounded-[10px] p-3">
              <TextField label="Description" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder={task?.name} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Amount (€)" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                <Select label="Category" value={expCat} onChange={(e) => setExpCat(e.target.value as ExpenseCategory)}>
                  {CATS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </div>
              <Select label="Payer" value={expPayer} onChange={(e) => setExpPayer(e.target.value)}>
                <option value="">Select payer…</option>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Sheet>

      <FailedPregnancySheet
        litter={confirmEndPlan ? litter ?? null : null}
        onClose={() => {
          setConfirmEndPlan(false);
          reset();
          onClose();
        }}
      />
    </>
  );
}
