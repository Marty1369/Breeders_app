# Environments, versioning & rollback

This project runs in three environments, each with its **own isolated Supabase
database** so testing never touches production data.

| Environment | Where | Supabase project | DB ref |
|-------------|-------|------------------|--------|
| **Local dev** | `npm run dev` on your machine | staging | `dxvrnvvmfjvsynizltwb` |
| **Staging** | the `staging` git branch → Vercel preview URL | staging | `dxvrnvvmfjvsynizltwb` |
| **Production** | the `main` branch → `breeders-app.vercel.app` | production | `zmdpsrbgbvwcmrwjvuzc` |

A header **STAGING** badge shows whenever the app is *not* pointed at production —
if you don't see it, you're editing real data.

## How the right database is chosen (no per-branch secrets)

`app/src/lib/supabase.ts` selects the database at build time:

1. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set (e.g. `app/.env.local`) → use them (explicit override).
2. Else if `VITE_APP_ENV === 'production'` → **production** DB.
3. Else (preview deploys, local dev, anything unknown) → **staging** DB. *Fails toward staging on purpose.*

`VITE_APP_ENV` is injected in `app/vite.config.ts` from Vercel's `VERCEL_ENV`
(`production` for the `main` production deploy, `preview` for every branch/preview
deploy). Verified: a production-mode build embeds only the prod DB; a preview
build embeds only staging. Publishable ("anon") keys are safe in the client
bundle — RLS is the real gate — so no secrets are committed.

> If you add a **custom domain**, nothing changes: the production deploy still
> builds with `VERCEL_ENV=production`. Only the domain string changes.

## Everyday workflow (dev → staging → production)

```
1. Develop locally         npm run dev      # talks to STAGING db, safe to break
2. Push a staging branch   git push origin HEAD:staging
                           # Vercel builds a preview URL (STAGING db) to click-test / share
3. Ship to production      merge staging → main, or push main
                           # Vercel deploys to breeders-app.vercel.app (PROD db)
```

You never *have* to use the `staging` branch — local dev already runs on the
staging DB — but it gives you a shareable hosted staging site before prod.

### Database (schema) changes

There is one DB per environment, so a schema change must be applied to each:

1. Write the change as a new numbered file in `app/supabase/migrations/` (e.g. `0007_*.sql`)
   **and** a matching reverse file in `app/supabase/migrations/down/`.
2. Apply it to **staging first** (Supabase SQL editor, or ask Claude — the Supabase
   MCP is connected), test the app against it.
3. When happy, apply the same file to **production**.
4. Commit both files. The ordered `migrations/` files are the source of truth and
   can rebuild any environment from scratch (that's exactly how staging was created).

## Versioning

Releases are marked with **git tags** and a version ↔ migration mapping:

| Tag | App | DB migrations through |
|-----|-----|-----------------------|
| `v1.0.0` | initial single-env production release | `0006` |
| `v1.1.0` | isolated staging + prod/staging DB routing | `0006` |

Tag a release: `git tag -a v1.2.0 -m "…" && git push origin v1.2.0`.

## Rolling back

### Revert the app (frontend) — instant, no DB needed
- **Vercel dashboard → Deployments → pick a previous good build → Promote to Production.** Live in seconds.
- Or in git: `git checkout v1.0.0` / `git revert <commit>` then push. The frontend
  is stateless, so this is always safe on its own.

### Revert the database
Pick the right tool for the scope:

- **Undo a specific migration (surgical):** run the matching file from
  `app/supabase/migrations/down/` (e.g. `0006_..._down.sql`) against that
  environment. Down-migrations that drop tables/columns also drop their data —
  read before running.
- **Revert the whole DB to an earlier point in time:** Supabase dashboard →
  **Database → Backups / Point-in-Time Recovery → Restore**. This is the "big red
  button" for accidental data loss. (Retention depends on your Supabase plan;
  enable PITR on production if you want fine-grained restore.)
- **Rebuild an environment from zero:** run `migrations/0001 … 0006` in order on a
  fresh project — proven, this is how staging was built.

### Reverting app + DB together
If a release changed both, revert them as a pair: promote the previous frontend
deploy **and** run the down-migration(s) for anything that release added, back to
the migration level in the version table above. Do the frontend first if the new
schema is additive (old frontend ignores new columns); do the DB first if the
release *removed* something the old frontend still needs.

## Reference

- Production Supabase: `zmdpsrbgbvwcmrwjvuzc` · https://zmdpsrbgbvwcmrwjvuzc.supabase.co
- Staging Supabase: `dxvrnvvmfjvsynizltwb` · https://dxvrnvvmfjvsynizltwb.supabase.co
- Both in Supabase org **kennel Compass**; both keep **their own** Auth users —
  a login on staging is not a login on production. Add each environment's live URL
  to that project's **Auth → URL Configuration** for password-reset/invite links.
