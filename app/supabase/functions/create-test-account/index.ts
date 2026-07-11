// create-test-account — QA helper (STAGING ONLY).
//
// Creates a pre-confirmed throwaway auth user via the service-role admin API so
// the login screen's "Test account A/B" buttons can spin up fresh accounts
// without email confirmation. `email_confirm: true` means GoTrue sends NO
// confirmation email, so this also sidesteps the default SMTP send-rate limit
// that would otherwise throttle repeated signups.
//
// Safety:
//   * Deployed to the STAGING project only (never prod).
//   * Body guard below hard-refuses if it ever finds itself running against the
//     production project ref.
//   * verify_jwt is disabled (the caller is unauthenticated by definition), so
//     the guard + staging-only deploy are the protection.
//
// The frontend only shows the buttons when !isProduction (see lib/supabase.ts),
// so this endpoint is unreachable from the production build.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PROD_PROJECT_REF = 'zmdpsrbgbvwcmrwjvuzc';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Belt-and-suspenders: refuse to ever mint test accounts on production.
  if (url.includes(PROD_PROJECT_REF)) {
    return json({ error: 'disabled_in_production' }, 403);
  }
  if (!url || !serviceKey) {
    return json({ error: 'missing_service_credentials' }, 500);
  }

  const persona = await req
    .json()
    .then((b) => (b?.persona === 'B' ? 'B' : 'A'))
    .catch(() => 'A');

  const admin = createClient(url, serviceKey);

  // Recognisable, unique, and on a domain GoTrue accepts (example.com/test.com
  // are on its invalid-domain blocklist; qa-breeder.app passes).
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 6);
  const email = `test-${persona.toLowerCase()}-${stamp}-${rand}@qa-breeder.app`;
  const password = 'test1234';
  const name = `Test User ${persona}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) return json({ error: error.message }, 400);

  return json({ email, password, name, userId: data.user?.id });
});
