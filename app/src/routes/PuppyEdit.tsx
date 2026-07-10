import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, EmptyState, PageHeader, Select, TextField } from '../components/ui';
import type { PuppyStatus } from '../lib/types';

const STATUS_OPTIONS: { value: PuppyStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'coowned', label: 'Co-owned' },
  { value: 'export', label: 'Export' },
  { value: 'deceased', label: 'Deceased' },
];

export default function PuppyEdit() {
  const { id } = useParams<{ id: string }>();
  const { puppies, litters, owners } = useSpace();
  const navigate = useNavigate();
  const puppy = puppies.find((p) => p.id === id);
  const litter = litters.find((l) => l.id === puppy?.litter_id);

  const [form, setForm] = useState({
    name: '', sex: '' as '' | 'male' | 'female', color: '', collarColor: '', markings: '',
    price: '', status: 'available' as PuppyStatus, litterAffix: '', regNo: '', chipNo: '', ownerId: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!puppy) return;
    setForm({
      name: puppy.name,
      sex: puppy.sex || '',
      color: puppy.color || '',
      collarColor: puppy.collar_color || '',
      markings: puppy.markings || '',
      price: puppy.price != null ? String(puppy.price) : '',
      status: puppy.status,
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
        collar_color: form.collarColor || null,
        markings: form.markings || null,
        price: form.price.trim() === '' ? null : Number(form.price),
        status: form.status,
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
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as PuppyStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Color" value={form.color} onChange={(e) => set('color', e.target.value)} />
          <TextField label="Collar color" value={form.collarColor} onChange={(e) => set('collarColor', e.target.value)} />
        </div>
        <TextField label="Markings" value={form.markings} onChange={(e) => set('markings', e.target.value)} placeholder="e.g. white blaze, NBT" />
        <TextField label="Price (€)" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} />
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
