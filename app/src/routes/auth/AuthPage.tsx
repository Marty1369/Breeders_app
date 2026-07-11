import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isProduction } from '../../lib/supabase';
import { setPendingInvite } from '../../lib/invite';
import { Button, Card, SegmentedControl, TextField } from '../../components/ui';

export default function AuthPage() {
  const [params] = useSearchParams();
  const inviteToken = params.get('invite');
  const [mode, setMode] = useState<'signin' | 'signup'>(inviteToken ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState<'A' | 'B' | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // Persist the invite so it survives the sign-up session round-trip.
    if (inviteToken) setPendingInvite(inviteToken);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        // When the project requires email confirmation, signUp() succeeds but
        // returns no session. Navigating on would bounce straight back to
        // /login with no explanation, stranding the user.
        if (!data.session) {
          setConfirmSent(true);
          return;
        }
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

  // QA helper (staging/preview/dev only — hidden on the production build).
  // Mints a pre-confirmed throwaway account via the create-test-account edge
  // function, then signs in and drops into the create-space wizard, so the
  // onboarding flow can be re-tested without email confirmation.
  async function createTestAccount(persona: 'A' | 'B') {
    setError(null);
    setTestBusy(persona);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-test-account', {
        body: { persona },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) throw signInError;
      navigate('/onboarding/create-space');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a test account');
    } finally {
      setTestBusy(null);
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

        {confirmSent && (
          <Card className="p-5 text-center">
            <div className="text-[15px] font-extrabold mb-1.5">Check your email</div>
            <div className="text-[12.5px] font-semibold text-muted">
              We sent a confirmation link to <span className="text-ink">{email}</span>. Open it to activate your
              account, then come back and sign in.
            </div>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                setConfirmSent(false);
                setMode('signin');
                setPassword('');
              }}
            >
              Back to sign in
            </Button>
          </Card>
        )}

        <Card className={`p-5 ${confirmSent ? 'hidden' : ''}`}>
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
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Aurelija Kazlauskienė" />
            )}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@kennel.com" />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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

        {!isProduction && !confirmSent && (
          <Card className="p-4 mt-4 border border-dashed border-accent/40 bg-accent-soft/40">
            <div className="text-[10.5px] font-extrabold text-accent tracking-wide mb-1">
              TESTING — STAGING ONLY
            </div>
            <div className="text-[11.5px] font-semibold text-muted mb-3">
              Spin up a fresh, pre-confirmed account (no email needed) and jump straight into the
              create-space flow.
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={testBusy !== null}
                onClick={() => createTestAccount('A')}
              >
                {testBusy === 'A' ? 'Creating…' : 'Test account A'}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={testBusy !== null}
                onClick={() => createTestAccount('B')}
              >
                {testBusy === 'B' ? 'Creating…' : 'Test account B'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
