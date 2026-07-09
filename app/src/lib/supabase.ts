import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment routing.
//
// We keep TWO isolated Supabase projects so testing never touches production
// data: `production` and `staging`. Which one a given build talks to is decided
// automatically — no per-branch env files (those cause merge accidents):
//
//   • VITE_SUPABASE_URL/ANON_KEY set (e.g. app/.env.local) → explicit override
//   • else VITE_APP_ENV === 'production'                    → production DB
//   • else (preview deploys, local dev, anything unknown)   → staging DB  ← safe default
//
// VITE_APP_ENV is injected from Vercel's VERCEL_ENV in the build command
// (see the repo-root vercel.json): main/production deploys get 'production',
// every branch/preview deploy gets 'preview'. Fail toward staging on purpose —
// an unrecognized context should never write to production.
//
// Publishable ("anon") keys are safe to ship in the client bundle; RLS is the
// real gate. See docs/ENVIRONMENTS.md.
// ---------------------------------------------------------------------------

const PRODUCTION = {
  url: 'https://zmdpsrbgbvwcmrwjvuzc.supabase.co',
  anonKey: 'sb_publishable_QETY2hZ6GpjJ0QRhikheGA_fegPJyxU',
};
const STAGING = {
  url: 'https://dxvrnvvmfjvsynizltwb.supabase.co',
  anonKey: 'sb_publishable_otIej4ZEBuoAzKvhAUcC_Q_ZYionJX1',
};

export type AppEnv = 'production' | 'staging';

const overrideUrl = import.meta.env.VITE_SUPABASE_URL;
const overrideKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const vercelEnv = import.meta.env.VITE_APP_ENV; // 'production' | 'preview' | 'development' | undefined

export const activeEnv: AppEnv = vercelEnv === 'production' ? 'production' : 'staging';

const base = activeEnv === 'production' ? PRODUCTION : STAGING;
const url = overrideUrl || base.url;
const anonKey = overrideKey || base.anonKey;

/** True when this build points at the real production database. */
export const isProduction = !overrideUrl && activeEnv === 'production';

export const supabase = createClient(url, anonKey);
