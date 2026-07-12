import { useEffect, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Select, Sheet, TextField } from './ui';
import type { Dog } from '../lib/types';

const BLANK_DOG_FORM = {
  name: '', sex: 'female' as 'female' | 'male', breed: '', dob: '', regNo: '', chipNo: '', registry: '',
  color: '', tail: '', eyes: '', eyesExamDate: '', hips: '', elbows: '', dentition: '', bite: '',
  titles: '', showResults: '', workingTests: '', faults: '', geneticsNotes: '',
  isExternal: false, extName: '', extPhone: '', extCity: '',
};

/**
 * Add / edit / delete a dog. Used from My dogs and from the New-litter wizard
 * (to add a sire as a full dog record, sex preset via `defaultSex`).
 * `onCreated` fires with the new dog id after a successful insert.
 */
export default function DogFormSheet({
  open,
  dog,
  litterCount,
  onClose,
  defaultSex = 'female',
  onCreated,
}: {
  open: boolean;
  dog: Dog | null;
  litterCount: number;
  onClose: () => void;
  defaultSex?: 'female' | 'male';
  onCreated?: (dogId: string) => void;
}) {
  const { space } = useSpace();
  const isEdit = dog !== null;
  const [form, setForm] = useState(BLANK_DOG_FORM);
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Hydrate the form from the dog in edit mode; reset to blank (with the default
  // sex) in add mode.
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
      setForm({ ...BLANK_DOG_FORM, sex: defaultSex });
    }
  }, [dog, open, defaultSex]);

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
      const { data } = await supabase.from('dogs').insert({ space_id: space.id, ...payload }).select('id').single();
      if (data?.id) onCreated?.(data.id);
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
      title={isEdit ? `Edit — ${dog?.name ?? ''}` : defaultSex === 'male' ? 'Add sire' : 'Add dog'}
      subtitle={isEdit ? undefined : 'Mum, dad, or external stud'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Basics — enough to save (spec §7 progressive disclosure). */}
        <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sex" value={form.sex} onChange={(e) => set('sex', e.target.value as 'female' | 'male')}>
            <option value="female">Female (mum)</option>
            <option value="male">Male (dad)</option>
          </Select>
          <TextField label="Breed" value={form.breed} onChange={(e) => set('breed', e.target.value)} />
        </div>
        <TextField label="Date of birth" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />

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

        {/* Everything else is optional — tucked away by default. */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center justify-between mt-1 text-[13px] font-extrabold text-accent cursor-pointer"
        >
          <span>Pedigree & health details</span>
          <span>{showMore ? '−' : '+'}</span>
        </button>

        {showMore && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} />
              <TextField label="Registry" value={form.registry} onChange={(e) => set('registry', e.target.value)} placeholder="LŠVK / LOF / CMKU" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Registration no." value={form.regNo} onChange={(e) => set('regNo', e.target.value)} />
              <TextField label="Chip no." value={form.chipNo} onChange={(e) => set('chipNo', e.target.value)} />
            </div>
            <TextField label="Tail" value={form.tail} onChange={(e) => set('tail', e.target.value)} placeholder="NBT / long / docked" />

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
