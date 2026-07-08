import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { Button, Card, TextField } from '../../components/ui';

export default function CreateSpaceWizard() {
  const { user } = useAuth();
  const { reloadMembership } = useSpace();
  const [form, setForm] = useState({
    kennelName: '',
    affix: '',
    breederName: (user?.user_metadata?.full_name as string) || '',
    breederAddress: '',
    breederPhone: '',
    breederEmail: user?.email || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_space', {
      p_name: form.kennelName || 'My kennel',
      p_kennel_name: form.kennelName || null,
      p_affix: form.affix || null,
      p_breeder_name: form.breederName || null,
      p_breeder_address: form.breederAddress || null,
      p_breeder_phone: form.breederPhone || null,
      p_breeder_email: form.breederEmail || null,
      p_member_name: form.breederName || user?.email || 'Member',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    reloadMembership();
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="p-5">
          <div className="text-[15.5px] font-extrabold mb-1">Create your kennel space</div>
          <div className="text-[11.5px] text-faint font-semibold mb-4">
            This becomes the shared workspace for your team — litters, dogs, tasks, and documents all live here.
            Breeder details prefill your contract templates.
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <TextField label="Kennel name" value={form.kennelName} onChange={(e) => set('kennelName', e.target.value)} required placeholder="Flying Aussie Kennel" />
            <TextField label="Kennel affix" value={form.affix} onChange={(e) => set('affix', e.target.value)} placeholder="Flying Aussie" />
            <TextField label="Your name" value={form.breederName} onChange={(e) => set('breederName', e.target.value)} required />
            <TextField label="Breeder address" value={form.breederAddress} onChange={(e) => set('breederAddress', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Phone" value={form.breederPhone} onChange={(e) => set('breederPhone', e.target.value)} />
              <TextField label="Email" type="email" value={form.breederEmail} onChange={(e) => set('breederEmail', e.target.value)} />
            </div>
            {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
            <Button type="submit" disabled={busy} className="w-full mt-1">
              {busy ? 'Creating…' : 'Create space'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
