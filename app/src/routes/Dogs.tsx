import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader, Sheet, TextField } from '../components/ui';
import { addDays, niceDate, todayStr } from '../lib/dates';
import { nextHeatPredicted } from '../lib/scheduling';
import type { Dog } from '../lib/types';
import NewLitterWizard from '../components/NewLitterWizard';
import DogFormSheet from '../components/DogFormSheet';

function ageFromDob(dob: string | null): string | null {
  if (!dob) return null;
  const years = (Date.now() - +new Date(dob)) / (365.25 * 86400000);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${years.toFixed(1)} y`;
}

export default function Dogs() {
  const { space, dogs, litters } = useSpace();
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [editDog, setEditDog] = useState<Dog | null>(null);
  const [wizardDog, setWizardDog] = useState<Dog | null>(null);
  const [heatDog, setHeatDog] = useState<Dog | null>(null);

  const wizardOpen = wizardDog !== null || params.get('new_litter') === '1';

  const litterCount = (dogId: string) => litters.filter((l) => l.dam_id === dogId || l.sire_id === dogId).length;

  const owned = useMemo(() => dogs.filter((d) => !d.is_external), [dogs]);
  const external = useMemo(() => dogs.filter((d) => d.is_external), [dogs]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="My dogs"
        subtitle={space?.kennel_name || undefined}
        action={
          <Button onClick={() => setAddOpen(true)} className="flex-none">
            ＋ Add dog
          </Button>
        }
      />

      {dogs.length === 0 ? (
        <EmptyState
          title="No dogs yet"
          subtitle="Add your dam and sire records to start planning litters."
          action={<Button onClick={() => setAddOpen(true)}>＋ Add dog</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {owned.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {owned.map((d) => (
                <DogCard key={d.id} dog={d} litterCount={litterCount(d.id)} onStartLitter={() => setWizardDog(d)} onLogHeat={() => setHeatDog(d)} onEdit={() => setEditDog(d)} />
              ))}
            </div>
          )}
          {external.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold tracking-wider text-faint mb-1.5 mt-2">EXTERNAL STUDS</div>
              <div className="flex flex-col gap-2.5">
                {external.map((d) => (
                  <DogCard key={d.id} dog={d} litterCount={litterCount(d.id)} onStartLitter={() => setWizardDog(d)} onLogHeat={() => setHeatDog(d)} onEdit={() => setEditDog(d)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DogFormSheet open={addOpen} dog={null} litterCount={0} onClose={() => setAddOpen(false)} />
      <DogFormSheet open={editDog !== null} dog={editDog} litterCount={editDog ? litterCount(editDog.id) : 0} onClose={() => setEditDog(null)} />
      <LogHeatSheet dog={heatDog} onClose={() => setHeatDog(null)} />
      <NewLitterWizard
        open={wizardOpen}
        prefillDam={wizardDog?.sex === 'female' ? wizardDog : null}
        prefillSire={wizardDog?.sex === 'male' ? wizardDog : null}
        onClose={() => {
          setWizardDog(null);
          if (params.get('new_litter')) {
            params.delete('new_litter');
            setParams(params, { replace: true });
          }
        }}
      />
    </div>
  );
}

function DogCard({
  dog,
  litterCount,
  onStartLitter,
  onLogHeat,
  onEdit,
}: {
  dog: Dog;
  litterCount: number;
  onStartLitter: () => void;
  onLogHeat: () => void;
  onEdit: () => void;
}) {
  const age = ageFromDob(dog.dob);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14.5px] font-extrabold flex items-center gap-2">
            {dog.name}
            <Chip tone="default">{dog.sex === 'female' ? '♀ dam' : '♂ sire'}</Chip>
            {dog.is_external && <Chip tone="amber">External</Chip>}
          </div>
          <div className="text-[11px] text-faint font-semibold mt-0.5">
            {[dog.breed, age, dog.reg_no].filter(Boolean).join(' · ') || '—'}
          </div>
          {dog.titles && <div className="text-[11px] text-accent font-extrabold mt-0.5">{dog.titles}</div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-extrabold text-muted whitespace-nowrap">{litterCount} litter{litterCount === 1 ? '' : 's'}</div>
          <button onClick={onEdit} className="text-[11px] font-extrabold text-accent cursor-pointer">Edit</button>
        </div>
      </div>

      {dog.sex === 'female' && !dog.is_external && (
        <div className="mt-3 flex items-center justify-between bg-app-bg border border-border-soft rounded-[10px] px-3 py-2">
          <div>
            <div className="text-[10px] font-extrabold text-faint tracking-wide">NEXT HEAT (PREDICTED)</div>
            <div className="text-[12.5px] font-extrabold mt-0.5">
              {dog.next_heat_predicted ? niceDate(dog.next_heat_predicted) : 'No heat logged yet'}
            </div>
          </div>
          <button onClick={onLogHeat} className="text-[11px] font-extrabold text-accent cursor-pointer">
            Log heat
          </button>
        </div>
      )}

      {dog.genetics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {dog.genetics.map((g, i) => (
            <Chip key={i}>{g.test}: {g.result}</Chip>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button variant="secondary" onClick={onStartLitter} className="w-full sm:w-auto">
          ＋ Start litter from {dog.name}
        </Button>
      </div>
    </Card>
  );
}

function LogHeatSheet({ dog, onClose }: { dog: Dog | null; onClose: () => void }) {
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!dog) return;
    setBusy(true);
    const heats = [...dog.heats, { startedAt: date }];
    await supabase
      .from('dogs')
      .update({ heats, next_heat_predicted: nextHeatPredicted(date) })
      .eq('id', dog.id);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet
      open={!!dog}
      onClose={onClose}
      title={`Log heat — ${dog?.name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <TextField label="Heat start date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      {date && (
        <div className="mt-3 bg-app-bg border border-border-soft rounded-[10px] p-3">
          <div className="text-[10px] font-extrabold tracking-wider text-faint mb-2">PREDICTED FROM THIS HEAT</div>
          <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
            <div className="flex justify-between"><span className="text-muted">Fertile window</span><span>{niceDate(addDays(date, 11))} – {niceDate(addDays(date, 15))}</span></div>
            <div className="flex justify-between"><span className="text-muted">Optimal breeding (ovulation)</span><span className="text-accent font-extrabold">{niceDate(addDays(date, 13))}</span></div>
            <div className="flex justify-between"><span className="text-muted">Second mating</span><span>{niceDate(addDays(date, 15))}</span></div>
            <div className="flex justify-between"><span className="text-muted">Predicted whelping</span><span>{niceDate(addDays(date, 75))}</span></div>
          </div>
          <div className="text-[10.5px] text-faint font-semibold mt-2">
            Confirm with a progesterone test around the fertile window — log it when you complete the progesterone task.
          </div>
        </div>
      )}

      {dog && dog.heats.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-extrabold tracking-wider text-faint mb-1.5">HISTORY</div>
          <div className="flex flex-col gap-1">
            {dog.heats.slice().reverse().map((h, i) => (
              <div key={i} className="text-[12px] font-semibold text-muted">{niceDate(h.startedAt)}</div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
