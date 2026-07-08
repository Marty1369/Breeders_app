import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader } from '../components/ui';

export default function CloseOut() {
  const { litters, activeLitterId, puppies, tasks, expenses, owners } = useSpace();
  const navigate = useNavigate();
  const litter = litters.find((l) => l.id === activeLitterId);
  const [busy, setBusy] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  const litterPuppies = puppies.filter((p) => p.litter_id === litter.id);
  const litterTasks = tasks.filter((t) => t.litter_id === litter.id);
  const openTasks = litterTasks.filter((t) => t.status !== 'done');
  const unresolved = litterPuppies.filter((p) => p.status !== 'deceased' && !p.handover.handedOverAt);

  const spent = expenses.filter((e) => e.litter_id === litter.id).reduce((s, e) => s + e.amount_eur, 0);
  const received = litterPuppies.reduce((s, p) => {
    const owner = owners.find((o) => o.id === p.owner_id);
    return s + (owner ? owner.payments.reduce((s2, pay) => s2 + pay.amount, 0) : 0);
  }, 0);

  const canClose = unresolved.length === 0 && litter.status !== 'closed';

  async function close() {
    setBusy(true);
    await supabase.from('litters').update({ status: 'closed' }).eq('id', litter!.id);
    setBusy(false);
    navigate('/');
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Close out" subtitle={litter.name} action={<Chip tone={litter.status === 'closed' ? 'default' : 'accent'}>{litter.status}</Chip>} />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4">
          <div className="text-[10px] font-extrabold text-faint tracking-wide">SPENT</div>
          <div className="text-[20px] font-extrabold mt-1">€{spent.toFixed(0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-extrabold text-faint tracking-wide">RECEIVED</div>
          <div className="text-[20px] font-extrabold mt-1">€{received.toFixed(0)}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">PUPPIES</div>
        <div className="flex flex-col gap-1.5">
          {litterPuppies.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[12.5px] font-bold">
              <span>{p.name}</span>
              {p.status === 'deceased' ? (
                <Chip tone="danger">Deceased</Chip>
              ) : p.handover.handedOverAt ? (
                <Chip tone="accent">Handed over</Chip>
              ) : (
                <Chip tone="amber">Not resolved</Chip>
              )}
            </div>
          ))}
        </div>
      </Card>

      {openTasks.length > 0 && (
        <div className="mb-4 text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
          {openTasks.length} task{openTasks.length === 1 ? '' : 's'} still open.
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="mb-4 text-[11.5px] font-semibold text-danger bg-danger-soft rounded-[10px] px-3 py-2">
          {unresolved.length} puppy{unresolved.length === 1 ? '' : 'ies'} not yet handed over or marked deceased.
        </div>
      )}

      {litter.status === 'closed' ? (
        <div className="text-[12px] font-bold text-muted text-center">This litter is closed and archived (read-only).</div>
      ) : (
        <Button onClick={close} disabled={!canClose || busy} className="w-full">
          {busy ? 'Closing…' : 'Close litter — archive'}
        </Button>
      )}
    </div>
  );
}
