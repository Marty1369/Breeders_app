import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Select, Sheet, TextField } from './ui';
import { todayStr } from '../lib/dates';
import type { ExpenseCategory } from '../lib/types';

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

export default function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { space, activeLitterId, payers } = useSpace();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<ExpenseCategory>('vet_tests');
  const [payerId, setPayerId] = useState(payers[0]?.id || '');
  const [date, setDate] = useState(todayStr());
  const [newPayer, setNewPayer] = useState('');
  const [addingPayer, setAddingPayer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0;

  async function save() {
    if (!space || !amountValid) return;
    setBusy(true);
    setError(null);
    let finalPayerId = payerId;
    if (addingPayer && newPayer.trim()) {
      const { data, error: payerErr } = await supabase.from('payers').insert({ space_id: space.id, label: newPayer.trim() }).select('id').single();
      if (payerErr) {
        setError(payerErr.message || 'Could not add payer. Try again.');
        setBusy(false);
        return;
      }
      finalPayerId = data?.id || '';
    }
    const { error: insertErr } = await supabase.from('expenses').insert({
      space_id: space.id,
      litter_id: activeLitterId,
      date,
      description: desc || CATS.find((c) => c.value === cat)?.label || 'Expense',
      category: cat,
      amount_eur: amountNum,
      payer_id: finalPayerId || null,
    });
    if (insertErr) {
      setError(insertErr.message || 'Could not save the expense. Try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setDesc('');
    setAmount('');
    setNewPayer('');
    setAddingPayer(false);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add expense"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !amountValid}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <div className="text-[12px] font-bold text-danger">{error}</div>}
        <TextField label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Amount (€)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">CATEGORY</div>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer ${cat === c.value ? 'bg-accent text-white' : 'bg-chip-bg text-muted'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {!addingPayer ? (
          <Select
            label="Payer"
            value={payerId}
            onChange={(e) => (e.target.value === '__new__' ? setAddingPayer(true) : setPayerId(e.target.value))}
          >
            <option value="">Select payer…</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="__new__">＋ Add payer…</option>
          </Select>
        ) : (
          <div className="flex gap-2 items-end">
            <TextField label="New payer" value={newPayer} onChange={(e) => setNewPayer(e.target.value)} className="flex-1" />
            <button onClick={() => setAddingPayer(false)} className="text-[11px] font-extrabold text-accent cursor-pointer mb-3">Cancel</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
