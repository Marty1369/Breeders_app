// A pending invite must survive the auth round-trip (open link → redirect to
// login → sign up → Supabase sets the session on a later tick → app re-renders).
// The token only living in the URL is fragile: any bounce through /login drops
// it and a brand-new (space-less) user then gets sent to create-space instead of
// joining. Persisting it in localStorage makes the flow robust to those bounces.

const KEY = 'litterPlanner.pendingInvite';

export function setPendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
