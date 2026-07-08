import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, EmptyState, PageHeader, Select, TextField } from '../components/ui';

export default function PuppyEdit() {
  const { id } = useParams<{ id: string }>();
  const { puppies, litters, owners } = useSpace();
  const navigate = useNavigate();
  const puppy = puppies.find((p) => p.id === id);
  const litter = litters.find((l) => l.id === puppy?.litter_id);

  const [form, setForm] = useState({
    name: '', sex: '' as '' | 'male' | 'female', color: '', litterAffix: '', regNo: '', chipNo: '', ownerId: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!puppy) return;
    setForm({
      name: puppy.name,
      sex: puppy.sex || '',
      color: puppy.color || '',
      litterAffix: puppy.litter_affix || '',
      regNo: puppy.reg_no || '',
      chipNo: puppy.chip_no || '',
      ownerId: puppy.owner_id || '',
    });
  }, [puppy]);

  if (!puppy) {
    return (
      <div className="p-6">
        <EmptyState title="Puppy not found" />
      </div>
    );
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const nameWarning = litter?.letter && form.name && !form.name.toUpperCase().startsWith(litter.letter.toUpperCase());

  async function save() {
    setBusy(true);
    await supabase
      .from('puppies')
      .update({
        name: form.name.trim(),
        sex: form.sex || null,
        color: form.color || null,
        litter_affix: form.litterAffix || null,
        reg_no: form.regNo || null,
        chip_no: form.chipNo || null,
        owner_id: form.ownerId || null,
      })
      .eq('id', puppy!.id);
    setBusy(false);
    navigate(`/puppies/${puppy!.id}`);
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Edit puppy" subtitle={litter?.name} />

      <div className="flex flex-col gap-3">
        <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        {nameWarning && (
          <div className="text-[11px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
            Litter letter is "{litter?.letter}" — this name doesn't start with it.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sex" value={form.sex} onChange={(e) => set('sex', e.target.value as 'male' | 'female' | '')}>
            <option value="">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
          <TextField label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} />
        </div>
        <TextField label="Litter affix" value={form.litterAffix} onChange={(e) => set('litterAffix', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Registration no." value={form.regNo} onChange={(e) => set('regNo', e.target.value)} />
          <TextField label="Chip no." value={form.chipNo} onChange={(e) => set('chipNo', e.target.value)} />
        </div>
        <Select label="Owner" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
          <option value="">Unlinked</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
