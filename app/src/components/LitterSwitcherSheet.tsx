import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Chip, Sheet } from './ui';
import type { Litter, LitterStatus } from '../lib/types';

const STATUS_LABEL: Record<LitterStatus, string> = {
  planned: 'Planned',
  pregnant: 'Pregnant',
  born: 'Nursing',
  closed: 'Closed',
  did_not_take: 'Did not take',
};

const STATUS_TONE: Record<LitterStatus, 'default' | 'accent' | 'amber' | 'danger'> = {
  planned: 'default',
  pregnant: 'accent',
  born: 'accent',
  closed: 'default',
  did_not_take: 'danger',
};

const isTerminal = (l: Litter) => l.status === 'closed' || l.status === 'did_not_take';

export default function LitterSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { litters, activeLitterId, setActiveLitterId } = useSpace();
  const navigate = useNavigate();

  const groups: { title: string; items: Litter[]; reactivate?: boolean }[] = [
    { title: 'Active', items: litters.filter((l) => l.is_active && !isTerminal(l)) },
    { title: 'Inactive', items: litters.filter((l) => !l.is_active && !isTerminal(l)), reactivate: true },
    { title: 'Archive', items: litters.filter(isTerminal) },
  ];

  async function pick(l: Litter, reactivate?: boolean) {
    if (reactivate && !l.is_active) {
      await supabase.from('litters').update({ is_active: true }).eq('id', l.id);
    }
    setActiveLitterId(l.id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Switch litter" subtitle="Pick which litter the app focuses on">
      <div className="flex flex-col gap-4">
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.title}>
                <div className="text-[10px] font-extrabold tracking-wider text-faint mb-1.5">{g.title.toUpperCase()}</div>
                <div className="flex flex-col gap-1.5">
                  {g.items.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => pick(l, g.reactivate)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-[11px] border cursor-pointer text-left ${
                        l.id === activeLitterId ? 'border-accent bg-accent-soft' : 'border-border-soft bg-app-bg'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-extrabold">{l.name}</span>
                        {l.id === activeLitterId && <Chip tone="accent">● Current</Chip>}
                      </span>
                      <span className="flex items-center gap-2">
                        {g.reactivate && <span className="text-[10px] font-extrabold text-accent">Reactivate</span>}
                        <Chip tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Chip>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
        )}
        <button
          onClick={() => {
            onClose();
            navigate('/dogs?new_litter=1');
          }}
          className="border-[1.5px] border-dashed border-accent-softer rounded-[11px] py-2.5 text-center text-[12px] font-extrabold text-accent cursor-pointer"
        >
          ＋ New litter
        </button>
      </div>
    </Sheet>
  );
}
