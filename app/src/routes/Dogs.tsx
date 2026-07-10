import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader, Select, Sheet, TextField } from '../components/ui';
import { niceDate, todayStr } from '../lib/dates';
import { nextHeatPredicted } from '../lib/scheduling';
import type { Dog } from '../lib/types';
import NewLitterWizard from '../components/NewLitterWizard';

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

const BLANK_DOG_FORM = {
  name: '', sex: 'female' as 'female' | 'male', breed: '', dob: '', regNo: '', chipNo: '', registry: '',
  color: '', tail: '', eyes: '', eyesExamDate: '', hips: '', elbows: '', dentition: '', bite: '',
  titles: '', showResults: '', workingTests: '', faults: '', geneticsNotes: '',
  isExternal: false, extName: '', extPhone: '', extCity: '',
};

function DogFormSheet({ open, dog, litterCount, onClose }: { open: boolean; dog: Dog | null; litterCount: number; onClose: () => void }) {
  const { space } = useSpace();
  const isEdit = dog !== null;
  const [form, setForm] = useState(BLANK_DOG_FORM);
  const [busy, setBusy] = useState(false);

  // Hydrate the form from the dog in edit mode; reset to blank in add mode.
  useEffect(() => {
    if (!open) return;
    if (dog) {
      setForm({
        name: dog.name, sex: dog.sex, breed: dog.breed || '', dob: dog.dob || '',
        regNo: dog.reg_no || '', chipNo: dog.chip_no || '', registry: dog.registry || '',
        color: dog.color || '', tail: dog.tail || '', eyes: dog.eyes || '', eyesExamDate: dog.eyes_exam_date || '',
        hips: dog.hips || '', elbows: dog.elbows || '', dentition: dog.dentition || '', bite: dog.bite || '',
        titles: dog.titles || '', showResults: dog.show_results || '', workingTests: dog.working_tests || '',
        faults: dog.faults || '', geneticsNotes: dog.genetics_notes || '',
        isExternal: dog.is_external,
        extName: dog.external_owner?.name || '', extPhone: dog.external_owner?.phone || '', extCity: dog.external_owner?.city || '',
      });
    } else {
      setForm(BLANK_DOG_FORM);
    }
  }, [dog, open]);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!space || !form.name.trim()) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      sex: form.sex,
      breed: form.breed || null,
      dob: form.dob || null,
      reg_no: form.regNo || null,
      chip_no: form.chipNo || null,
      registry: form.registry || null,
      color: form.color || null,
      tail: form.tail || null,
      eyes: form.eyes || null,
      eyes_exam_date: form.eyesExamDate || null,
      hips: form.hips || null,
      elbows: form.elbows || null,
      dentition: form.dentition || null,
      bite: form.bite || null,
      titles: form.titles || null,
      show_results: form.showResults || null,
      working_tests: form.workingTests || null,
      faults: form.faults || null,
      genetics_notes: form.geneticsNotes || null,
      is_external: form.isExternal,
      external_owner: form.isExternal ? { name: form.extName, phone: form.extPhone, city: form.extCity } : null,
    };
    if (isEdit) {
      await supabase.from('dogs').update(payload).eq('id', dog!.id);
    } else {
      await supabase.from('dogs').insert({ space_id: space.id, ...payload });
    }
    setBusy(false);
    onClose();
  }

  async function remove() {
    if (!dog) return;
    if (litterCount > 0) return; // guarded in UI too
    if (!confirm(`Delete ${dog.name}? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.from('dogs').delete().eq('id', dog.id);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit — ${dog?.name ?? ''}` : 'Add dog'}
      subtitle={isEdit ? undefined : 'Dam, sire, or external stud'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sex" value={form.sex} onChange={(e) => set('sex', e.target.value as 'female' | 'male')}>
            <option value="female">Female (dam)</option>
            <option value="male">Male (sire)</option>
          </Select>
          <TextField label="Breed" value={form.breed} onChange={(e) => set('breed', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date of birth" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
          <TextField label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Registry" value={form.registry} onChange={(e) => set('registry', e.target.value)} placeholder="LŠVK / LOF / CMKU" />
          <TextField label="Registration no." value={form.regNo} onChange={(e) => set('regNo', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Chip no." value={form.chipNo} onChange={(e) => set('chipNo', e.target.value)} />
          <TextField label="Tail" value={form.tail} onChange={(e) => set('tail', e.target.value)} placeholder="NBT / long / docked" />
        </div>

        <div className="text-[10px] font-extrabold tracking-wider text-faint mt-1">HEALTH & CONFORMATION</div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Hips" value={form.hips} onChange={(e) => set('hips', e.target.value)} placeholder="A" />
          <TextField label="Elbows" value={form.elbows} onChange={(e) => set('elbows', e.target.value)} placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Eyes" value={form.eyes} onChange={(e) => set('eyes', e.target.value)} placeholder="clear" />
          <TextField label="Eye exam date" type="date" value={form.eyesExamDate} onChange={(e) => set('eyesExamDate', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Dentition" value={form.dentition} onChange={(e) => set('dentition', e.target.value)} placeholder="full / 42" />
          <TextField label="Bite" value={form.bite} onChange={(e) => set('bite', e.target.value)} placeholder="scissor" />
        </div>
        <TextField label="Genetic tests" value={form.geneticsNotes} onChange={(e) => set('geneticsNotes', e.target.value)} placeholder="MDR1 & DM (carrier), HSF4, CEA, PRA - clear" />

        <div className="text-[10px] font-extrabold tracking-wider text-faint mt-1">TITLES & RESULTS</div>
        <TextField label="Titles" value={form.titles} onChange={(e) => set('titles', e.target.value)} placeholder="LT JCH, LV JCH, BALTIC JCH" />
        <TextField label="Show results" value={form.showResults} onChange={(e) => set('showResults', e.target.value)} placeholder="3xCAC, 2xN" />
        <TextField label="Working tests" value={form.workingTests} onChange={(e) => set('workingTests', e.target.value)} placeholder="NHAT test" />
        <TextField label="Faults / notes" value={form.faults} onChange={(e) => set('faults', e.target.value)} />

        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input type="checkbox" checked={form.isExternal} onChange={(e) => set('isExternal', e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
          <span className="text-[12.5px] font-bold">This is a visiting/external stud</span>
        </label>
        {form.isExternal && (
          <div className="flex flex-col gap-3 bg-app-bg border border-border-soft rounded-[10px] p-3">
            <TextField label="Owner name" value={form.extName} onChange={(e) => set('extName', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Owner phone" value={form.extPhone} onChange={(e) => set('extPhone', e.target.value)} />
              <TextField label="City" value={form.extCity} onChange={(e) => set('extCity', e.target.value)} />
            </div>
          </div>
        )}

        {isEdit && (
          <div className="mt-2 pt-3 border-t border-border-soft">
            {litterCount > 0 ? (
              <div className="text-[11px] font-semibold text-faint">
                Can't delete — this dog is linked to {litterCount} litter{litterCount === 1 ? '' : 's'}.
              </div>
            ) : (
              <button onClick={remove} disabled={busy} className="text-[12px] font-extrabold text-danger cursor-pointer">
                Delete dog
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
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
