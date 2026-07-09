/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional explicit overrides (e.g. app/.env.local). When unset, the Supabase
  // client routes by VITE_APP_ENV — see src/lib/supabase.ts.
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Injected from Vercel's VERCEL_ENV in the build command (vercel.json).
  readonly VITE_APP_ENV?: 'production' | 'preview' | 'development';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
