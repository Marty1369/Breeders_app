# Database setup

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `migrations/0001_init.sql` and click **Run**.
3. Copy your **Project URL** and **anon/public key** from **Project Settings → API**.
4. In `app/`, copy `.env.example` to `.env.local` and fill in those two values.

Future schema changes will be added as new files in `migrations/` (e.g. `0002_*.sql`) — run each new one the same way, in order, after pulling.
