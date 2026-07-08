import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Card, SegmentedControl, TextField } from '../../components/ui';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        navigate(inviteToken ? `/join/${inviteToken}` : '/onboarding/create-space');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate(inviteToken ? `/join/${inviteToken}` : '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-[11px] bg-accent grid place-items-center">
            <div className="grid grid-cols-2 gap-[3px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
              ))}
            </div>
          </div>
          <div className="text-[16px] font-extrabold">Litter Planner</div>
        </div>

        <Card className="p-5">
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Sign up' },
            ]}
          />

          {inviteToken && (
            <div className="mt-3 text-[11.5px] font-semibold text-accent bg-accent-soft rounded-[10px] px-3 py-2">
              You're joining via an invite link — finish {mode === 'signup' ? 'signing up' : 'signing in'} to continue.
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3 mt-4">
            {mode === 'signup' && (
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Aurelija Kazlauskienė" />
            )}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@kennel.com" />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
            />
            {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-4 text-[11.5px] font-bold">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
