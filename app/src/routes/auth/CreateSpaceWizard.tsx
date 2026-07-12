import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { clearPendingInvite } from '../../lib/invite';
import { Card } from '../../components/ui';

export default function CreateSpaceWizard() {
  const { user } = useAuth();
  const { reloadMembership } = useSpace();
  const [kennelName, setKennelName] = useState('');
  const [breederName, setBreederName] = useState((user?.user_metadata?.full_name as string) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Only kennel + your name up front. Breeder address/contact are collected
    // later, at first document generation (spec §7). RPC unchanged — pass nulls.
    const { error: err } = await supabase.rpc('create_space', {
      p_name: kennelName || 'My kennel',
      p_kennel_name: kennelName || null,
      p_affix: null,
      p_breeder_name: breederName || null,
      p_breeder_address: null,
      p_breeder_phone: null,
      p_breeder_email: null,
      p_member_name: breederName || user?.email || 'Member',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    clearPendingInvite();
    reloadMembership();
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="p-6 border-0" style={{ background: '#123f2d' }}>
          <div className="text-[20px] font-extrabold text-white mb-1">Welcome! What's your kennel called?</div>
          <div className="text-[12.5px] text-white/70 font-semibold mb-5">Two quick things and you're in.</div>
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-extrabold text-white/80">Kennel name</span>
              <input
                value={kennelName}
                onChange={(e) => setKennelName(e.target.value)}
                required
                autoFocus
                placeholder="Flying Aussie Kennel"
                className="min-h-11 px-3 rounded-[12px] bg-white/10 text-white placeholder:text-white/40 text-[15px] font-semibold border border-white/15 focus:outline-none focus:border-[#7fd4ae]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-extrabold text-white/80">Your name</span>
              <input
                value={breederName}
                onChange={(e) => setBreederName(e.target.value)}
                required
                placeholder="Aurelija"
                className="min-h-11 px-3 rounded-[12px] bg-white/10 text-white placeholder:text-white/40 text-[15px] font-semibold border border-white/15 focus:outline-none focus:border-[#7fd4ae]"
              />
            </label>
            {error && <div className="text-[12px] font-semibold text-[#f2b8b0]">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full mt-1 min-h-12 rounded-[12px] font-extrabold text-[15px] cursor-pointer disabled:opacity-60"
              style={{ background: '#7fd4ae', color: '#123f2d' }}
            >
              {busy ? 'Creating…' : "Let's go →"}
            </button>
            <div className="text-[11.5px] text-white/55 font-semibold text-center mt-1">
              Address & contract details? We'll ask when you generate your first document — not before.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
