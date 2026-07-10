import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { clearPendingInvite, setPendingInvite } from '../../lib/invite';
import { Button, Card, Spinner, TextField } from '../../components/ui';

export default function JoinInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const { reloadMembership } = useSpace();
  const navigate = useNavigate();
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the invite immediately so it survives the sign-up round-trip.
  useEffect(() => {
    if (token) setPendingInvite(token);
  }, [token]);

  useEffect(() => {
    if (!loading && !user && token) {
      navigate(`/login?invite=${token}`, { replace: true });
    }
  }, [loading, user, token, navigate]);

  async function join() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('join_space_via_invite', {
      p_token: token,
      p_member_name: name || user?.email || 'Member',
    });
    setBusy(false);
    if (err) {
      setError(err.message === 'invite_invalid_or_expired' ? 'This invite link is invalid or has expired.' : err.message);
      return;
    }
    clearPendingInvite();
    reloadMembership();
    navigate('/', { replace: true });
  }

  if (loading || !user) {
    return (
      <div className="min-h-full grid place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Card className="p-5">
          <div className="text-[15.5px] font-extrabold mb-1">Join the kennel space</div>
          <div className="text-[11.5px] text-faint font-semibold mb-4">
            You've been invited to join a Litter Planner space as a team member.
          </div>
          <div className="flex flex-col gap-3">
            <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
            <Button disabled={busy || !name} onClick={join} className="w-full">
              {busy ? 'Joining…' : 'Join space'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
