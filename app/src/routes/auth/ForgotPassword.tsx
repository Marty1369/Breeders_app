import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Card, TextField } from '../../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Card className="p-5">
          <div className="text-[15.5px] font-extrabold mb-1">Reset your password</div>
          <div className="text-[11.5px] text-faint font-semibold mb-4">
            We'll email you a link that's valid for 1 hour.
          </div>
          {sent ? (
            <div className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-[10px] px-3 py-3">
              Check your inbox for a reset link.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
          <div className="mt-4 text-[11.5px] font-bold">
            <Link to="/login">Back to sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
