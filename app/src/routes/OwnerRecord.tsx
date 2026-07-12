import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader, Select, TextField } from '../components/ui';
import { longDate, todayStr } from '../lib/dates';
import type { OwnerPayment } from '../lib/types';

export default function OwnerRecord() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { owners, puppies, litters } = useSpace();
  const owner = owners.find((o) => o.id === id);
  const puppy = puppies.find((p) => p.owner_id === id);

  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', country: '',
    fullPrice: 0, handoverDate: '', notes: '',
  });
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payKind, setPayKind] = useState<'deposit' | 'final'>('deposit');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hydrate the form once the owner row loads. Without this, a direct URL load
  // (owners not yet fetched) would leave the form blank and Save would overwrite
  // the real record with blanks.
  useEffect(() => {
    if (!owner) return;
    setForm({
      name: owner.name || '',
      address: owner.address || '',
      phone: owner.phone || '',
      email: owner.email || '',
      country: owner.country || '',
      fullPrice: owner.full_price ?? 0,
      handoverDate: owner.handover_date || '',
      notes: owner.notes || '',
    });
    setHydrated(true);
  }, [owner]);

  if (!owner) {
    return (
      <div className="p-6">
        <EmptyState title="Owner not found" />
      </div>
    );
  }

  const paid = owner.payments.reduce((s, p) => s + p.amount, 0);
  const waitingLitter = litters.find((l) => l.id === owner.waiting_list_for);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    await supabase
      .from('owners')
      .update({
        name: form.name.trim(),
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        country: form.country || null,
        full_price: Number(form.fullPrice) || 0,
        handover_date: form.handoverDate || null,
        notes: form.notes || null,
      })
      .eq('id', owner!.id);
    setBusy(false);
  }

  async function addPayment() {
    if (!payAmount) return;
    const payment: OwnerPayment = { amount: Number(payAmount), date: todayStr(), kind: payKind };
    await supabase.from('owners').update({ payments: [...owner!.payments, payment] }).eq('id', owner!.id);
    setPayAmount('');
  }

  // Owner delete. puppies.owner_id is ON DELETE SET NULL, so any linked puppy is
  // simply unlinked (kept), no cascade of puppy rows.
  const deleteOwner = async () => {
    setDeleting(true);
    await supabase.from('owners').delete().eq('id', owner!.id);
    setDeleting(false);
    navigate('/buyers');
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title={owner.name} subtitle={puppy ? `Puppy: ${puppy.name}` : waitingLitter ? `Waiting list — ${waitingLitter.name}` : undefined} />

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">CONTACT</div>
        <div className="flex flex-col gap-3">
          <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <TextField label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <TextField label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <TextField label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} />
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">KENNEL DATA</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <TextField label="Full price (€)" type="number" value={form.fullPrice} onChange={(e) => set('fullPrice', Number(e.target.value))} />
          <TextField label="Handover date" type="date" value={form.handoverDate} onChange={(e) => set('handoverDate', e.target.value)} />
        </div>
        <TextField label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <Button onClick={save} disabled={busy || !hydrated} className="mt-3">{busy ? 'Saving…' : 'Save'}</Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-extrabold text-faint tracking-wide">PAYMENTS</div>
          <div className="text-[12px] font-extrabold">€{paid.toFixed(0)} / €{form.fullPrice}</div>
        </div>
        <div className="flex flex-col gap-1.5 mb-3">
          {owner.payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-[12px] font-bold">
              <span className="text-muted">{p.kind} · {longDate(p.date)}</span>
              <span>€{p.amount}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <TextField placeholder="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="flex-1" />
          <Select value={payKind} onChange={(e) => setPayKind(e.target.value as 'deposit' | 'final')}>
            <option value="deposit">Deposit</option>
            <option value="final">Final</option>
          </Select>
          <Button variant="secondary" onClick={addPayment} disabled={!payAmount}>Add</Button>
        </div>
      </Card>

      <Card className="p-4 mt-4 border border-[#b93a2e]/25">
        <div className="text-[11px] font-extrabold text-[#b93a2e] tracking-wide mb-1">DANGER ZONE</div>
        <p className="text-[12.5px] text-faint mb-3">
          Delete this buyer. Any puppy linked to them is kept but unlinked. This can't be undone.
        </p>
        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>Delete buyer</Button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-bold">Delete {owner.name} permanently?</span>
            <div className="flex gap-2">
              <Button variant="danger" onClick={deleteOwner} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, delete buyer'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
