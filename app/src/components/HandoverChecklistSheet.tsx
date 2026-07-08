import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Sheet } from './ui';
import type { Puppy } from '../lib/types';

export default function HandoverChecklistSheet({ puppy, onClose }: { puppy: Puppy | null; onClose: () => void }) {
  const { owners } = useSpace();
  const [busy, setBusy] = useState(false);

  if (!puppy) return null;

  const owner = owners.find((o) => o.id === puppy.owner_id);
  const paid = owner ? owner.payments.reduce((s, p) => s + p.amount, 0) : 0;
  const paymentComplete = !!owner && owner.full_price > 0 && paid >= owner.full_price;

  const handover = { ...puppy.handover, paymentComplete };
  const gateOk = handover.contractSigned && handover.paymentComplete && handover.chipRegistered && handover.passportGiven;

  async function toggle(key: 'contractSigned' | 'chipRegistered' | 'passportGiven') {
    if (!puppy) return;
    const next = { ...puppy.handover, paymentComplete, [key]: !puppy.handover[key] };
    await supabase.from('puppies').update({ handover: next }).eq('id', puppy.id);
  }

  async function markHandedOver() {
    if (!puppy) return;
    setBusy(true);
    await supabase
      .from('puppies')
      .update({ handover: { ...puppy.handover, paymentComplete, handedOverAt: new Date().toISOString() } })
      .eq('id', puppy.id);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet
      open={!!puppy}
      onClose={onClose}
      title="Handover checklist"
      subtitle={puppy.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={markHandedOver} disabled={!gateOk || busy}>{busy ? 'Saving…' : 'Mark handed over'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Row label="Contract signed" checked={handover.contractSigned} onToggle={() => toggle('contractSigned')} />
        <Row label={`Payment complete (${paid} / ${owner?.full_price ?? 0} €)`} checked={handover.paymentComplete} readOnly />
        <Row label="Chip registered" checked={handover.chipRegistered} onToggle={() => toggle('chipRegistered')} />
        <Row label="Passport given" checked={handover.passportGiven} onToggle={() => toggle('passportGiven')} />
      </div>
      {!owner && (
        <div className="mt-3 text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
          No owner linked yet — link one from the puppy edit screen to track payments.
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, checked, onToggle, readOnly }: { label: string; checked: boolean; onToggle?: () => void; readOnly?: boolean }) {
  return (
    <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border ${checked ? 'border-accent bg-accent-soft' : 'border-border-soft bg-app-bg'} ${readOnly ? '' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={readOnly} onChange={onToggle} className="w-[18px] h-[18px] accent-[#17805a]" />
      <span className="text-[12.5px] font-bold">{label}</span>
    </label>
  );
}
