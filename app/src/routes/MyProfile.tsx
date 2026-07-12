import { useEffect, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Avatar, Button, Card, PageHeader, TextField } from '../components/ui';

const COLORS = ['#17805a', '#2f6f63', '#7c5f8f', '#b97324', '#4a6fa5', '#b93a2e'];

export default function MyProfile() {
  const { me } = useSpace();
  const [form, setForm] = useState({ name: '', phone: '', color: COLORS[0] });
  const [prefs, setPrefs] = useState({ push: true, email: false, assignments: true, milestones: true, teammatesTasks: false });
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Hydrate once `me` loads, so a direct load doesn't Save blanks over the
  // real profile (name/phone/avatar/notif prefs).
  useEffect(() => {
    if (!me) return;
    setForm({ name: me.name || '', phone: me.phone || '', color: me.avatar_color || COLORS[0] });
    setPrefs(me.notif_prefs || { push: true, email: false, assignments: true, milestones: true, teammatesTasks: false });
    setHydrated(true);
  }, [me]);

  if (!me) return null;

  async function save() {
    setBusy(true);
    await supabase
      .from('space_members')
      .update({ name: form.name.trim(), phone: form.phone || null, avatar_color: form.color, notif_prefs: prefs })
      .eq('id', me!.id);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: 'global' });
  }

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc('delete_account');
    if (error) {
      setDeleteError(error.message || 'Could not delete account. Try again.');
      setDeleting(false);
      return;
    }
    // The auth user is gone server-side; clearing the local session drops us
    // back to the login screen (and, if this was the sole member, the space and
    // all its data were deleted too).
    await supabase.auth.signOut();
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="My profile" />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={form.name || me.name} color={form.color} size={48} />
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className="w-6 h-6 rounded-full cursor-pointer border-2"
                style={{ background: c, borderColor: form.color === c ? '#191c1a' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <TextField label="Email" value={me.email || ''} disabled />
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">NOTIFICATIONS</div>
        <div className="flex flex-col gap-2.5">
          {(
            [
              ['push', 'Push notifications'],
              ['email', 'Email notifications'],
              ['assignments', 'My assignments'],
              ['milestones', 'Litter milestones'],
              ['teammatesTasks', "Teammates' tasks"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-[12.5px] font-bold">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                className="w-[18px] h-[18px] accent-[#17805a]"
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || !hydrated}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="ghost" onClick={signOut}>Sign out</Button>
        <Button variant="ghost" onClick={signOutEverywhere}>Sign out everywhere</Button>
      </div>

      <Card className="p-4 mt-6 border border-[#b93a2e]/25">
        <div className="text-[11px] font-extrabold text-[#b93a2e] tracking-wide mb-1">DANGER ZONE</div>
        <p className="text-[12.5px] text-faint mb-3">
          Permanently delete your account. If you're the only member of your space, the space and all
          its litters, dogs, tasks and documents are deleted too. This can't be undone.
        </p>
        {deleteError && (
          <p className="text-[12px] font-bold text-[#b93a2e] mb-2">{deleteError}</p>
        )}
        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}>
            Delete account
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-bold">Delete your account permanently?</span>
            <div className="flex gap-2">
              <Button variant="danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, delete my account'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
