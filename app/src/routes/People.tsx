import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Avatar, Button, Card, Chip, EmptyState, PageHeader, Select, SegmentedControl, Sheet, TextField } from '../components/ui';

export default function People({ initialTab }: { initialTab?: 'team' | 'owners' }) {
  const [params, setParams] = useSearchParams();
  const tab = ((params.get('tab') ?? initialTab ?? 'team') === 'owners' ? 'owners' : 'team') as 'team' | 'owners';

  function setTab(t: 'team' | 'owners') {
    params.set('tab', t);
    setParams(params, { replace: true });
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title={tab === 'owners' ? 'Buyers' : 'Team'} />
      <div className="mb-4">
        <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'team', label: 'In this space' }, { value: 'owners', label: 'Buyers' }]} />
      </div>
      {tab === 'team' ? <TeamTab /> : <OwnersTab />}
    </div>
  );
}

function TeamTab() {
  const { space, members, tasks } = useSpace();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const inviteUrl = space ? `${window.location.origin}/join/${space.invite_token}` : '';

  function workload(userId: string) {
    return tasks.filter((t) => t.status !== 'done' && t.assignee_ids.includes(userId)).length;
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!space) return;
    setBusy(true);
    await supabase.rpc('rotate_invite', { p_space_id: space.id });
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">INVITE LINK</div>
        <div className="text-[11.5px] font-semibold bg-muted-bg rounded-[8px] px-2.5 py-2 break-all mb-3">{inviteUrl}</div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copyInvite}>{copied ? 'Copied ✓' : 'Copy link'}</Button>
          <Button variant="ghost" onClick={rotate} disabled={busy}>{busy ? 'Rotating…' : 'Rotate link'}</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-1.5">
        {members.map((m) => (
          <Card key={m.id} className="p-3 flex items-center gap-3">
            <Avatar name={m.name} color={m.avatar_color} size={38} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold truncate">{m.name}</div>
              <div className="text-[10.5px] text-faint font-semibold truncate">{m.email}</div>
            </div>
            <Chip>{workload(m.user_id)} open</Chip>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OwnersTab() {
  const { owners, litters, puppies, activeLitterId } = useSpace();
  const [search, setSearch] = useState('');
  const [litterFilter, setLitterFilter] = useState('');
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // "This litter" = owners tied to the active litter (buyer of one of its pups,
  // or on its waiting list). "All litters" = every owner in the space.
  const [scope, setScope] = useState<'litter' | 'all'>('litter');
  const effectiveScope = activeLitterId ? scope : 'all';

  // Owner ids that bought a puppy in the active litter.
  const activeLitterOwnerIds = useMemo(
    () => new Set(puppies.filter((p) => p.litter_id === activeLitterId && p.owner_id).map((p) => p.owner_id)),
    [puppies, activeLitterId],
  );

  const filtered = useMemo(() => {
    return owners.filter((o) => {
      if (effectiveScope === 'litter' && !(activeLitterOwnerIds.has(o.id) || o.waiting_list_for === activeLitterId))
        return false;
      if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
      // A buyer belongs to a litter both via its waiting list AND via an
      // assigned puppy (puppy.owner_id) — filtering on waiting list alone
      // hides buyers who already reserved (audit N4).
      if (
        litterFilter &&
        o.waiting_list_for !== litterFilter &&
        !puppies.some((p) => p.litter_id === litterFilter && p.owner_id === o.id)
      )
        return false;
      if (waitingOnly && !o.waiting_list_for) return false;
      if (missingOnly && o.address && o.phone && o.email) return false;
      return true;
    });
  }, [owners, puppies, search, litterFilter, waitingOnly, missingOnly, effectiveScope, activeLitterOwnerIds, activeLitterId]);

  return (
    <div>
      {activeLitterId && (
        <div className="mb-4">
          <SegmentedControl
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: 'litter', label: 'This litter' },
              { value: 'all', label: 'All litters' },
            ]}
          />
        </div>
      )}
      <div className="flex flex-col gap-2.5 mb-4">
        <div className="flex gap-2">
          <TextField className="flex-1" placeholder="Search owners…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={() => setAddOpen(true)} className="flex-none">＋ Add</Button>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={litterFilter} onChange={(e) => setLitterFilter(e.target.value)} className="!min-h-9 text-[12px]">
            <option value="">All litters</option>
            {litters.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
          <FilterChip active={waitingOnly} onClick={() => setWaitingOnly((v) => !v)} label="Waiting list" />
          <FilterChip active={missingOnly} onClick={() => setMissingOnly((v) => !v)} label="Missing data" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No owners found" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((o) => {
            const puppy = puppies.find((p) => p.owner_id === o.id);
            return (
              <Link to={`/owners/${o.id}`} key={o.id}>
                <Card className="p-3 flex items-center justify-between cursor-pointer">
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold truncate">{o.name}</div>
                    <div className="text-[10.5px] text-faint font-semibold truncate">{[o.country, puppy?.name].filter(Boolean).join(' · ') || o.phone || o.email}</div>
                  </div>
                  {o.waiting_list_for && <Chip tone="amber">Waiting list</Chip>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AddOwnerSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer ${active ? 'bg-accent text-white' : 'bg-chip-bg text-muted'}`}
    >
      {label}
    </button>
  );
}

export function AddOwnerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { space, activeLitterId } = useSpace();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!space || !name.trim()) return;
    setBusy(true);
    await supabase.from('owners').insert({
      space_id: space.id,
      name: name.trim(),
      phone: phone || null,
      waiting_list_for: waiting ? activeLitterId : null,
      handover_date: null,
    });
    setBusy(false);
    setName('');
    setPhone('');
    setWaiting(false);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add owner"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} className="w-[18px] h-[18px] accent-[#17805a]" />
          <span className="text-[12.5px] font-bold">Add to waiting list for the active litter</span>
        </label>
      </div>
    </Sheet>
  );
}
