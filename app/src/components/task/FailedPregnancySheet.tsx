import { useState } from 'react';
import { useSpace } from '../../state/SpaceProvider';
import { useAuth } from '../../state/AuthProvider';
import { Button, Sheet } from '../ui';
import { endPlan } from '../../lib/actions';
import type { Litter } from '../../lib/types';

export default function FailedPregnancySheet({ litter, onClose }: { litter: Litter | null; onClose: () => void }) {
  const { tasks, members } = useSpace();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!litter) return;
    setBusy(true);
    await endPlan(litter, tasks, members, user?.id);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet
      open={!!litter}
      onClose={onClose}
      title="End plan — did not take"
      subtitle={litter?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? 'Ending…' : 'End this plan'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[12.5px] font-semibold text-muted leading-relaxed">
        <p>This confirms the pregnancy did not take. Here's what happens:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>All open tasks on this litter are cancelled.</li>
          <li>The litter record and its expenses are kept for your records.</li>
          <li>The heat is already logged on the dam, and her next-heat prediction stays visible on My dogs.</li>
          <li>Your team gets a notification that the plan ended.</li>
        </ul>
      </div>
    </Sheet>
  );
}
