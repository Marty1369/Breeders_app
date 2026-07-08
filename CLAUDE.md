# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A kennel litter-planning PWA for a small team ("space") that manages dog litters: an auto-scheduled task timeline, dog/puppy records, document generation, expenses, and an in-app notification feed. Built from a Claude Design prototype whose handoff package lives in `Design/`.

The app is a React 19 + TypeScript + Vite SPA backed by **Supabase** (Postgres + Auth + Realtime + Storage). There is no mock layer — all data is real and multi-tenant.

## Repo layout

- `app/` — the actual application. **All npm/build/dev commands run from here**, not the repo root.
- `app/supabase/migrations/` — SQL schema, applied in order: `0001_init` (tables, RLS, `create_space`/`join_space_via_invite`/`rotate_invite` RPCs, storage) · `0002_recurrence` · `0003_litter_active` · `0004_task_dependencies` · `0005_real_task_plan` (`seed_default_templates` = the kennel's 51-task plan; `create_space` now calls it).
- Repo root holds `vercel.json` (builds the `app/` subfolder — see Deployment) and `CLAUDE.md`; the app is a subfolder, not the repo root.
- `Design/extracted2/web-future-litter-planning-app/project/` — the design source of truth: `Litter Planner App.dc.html` (interactive prototype with an embedded `Component` class), `handoff/*.md` (SPEC, SCREENS, FLOWS, DECISIONS), and `components/` + `guidelines/` (the design system). **When the handoff prose and the prototype disagree, the prototype wins.**

## Environment gotchas (Windows)

- **Node is not on the Bash tool's PATH.** Every Bash command that runs node/npm/npx must prefix: `export PATH="/c/Program Files/nodejs:$PATH"`. PowerShell inherits the machine PATH and works without this. Node was installed via winget; the machine PATH has it.
- The preview dev server is launched via `.claude/launch.json`, which invokes `node.exe` against `app/node_modules/vite/bin/vite.js` **directly** — the `npm.cmd` shim fails here with `'"node"' is not recognized`. Keep that config shape if editing it.

## Commands (run from `app/`)

```bash
export PATH="/c/Program Files/nodejs:$PATH"   # Bash only
npm run dev          # vite dev server (port 5173)
npm run build        # tsc -b && vite build  (production build; catches more than typecheck alone)
npm run lint         # oxlint
npm run preview      # serve the production build (port 4173)
npx tsc --noEmit -p tsconfig.app.json   # typecheck only — run this frequently while editing
```

There is **no test framework configured**. "Verification" means: typecheck, then drive the app in the browser via the preview tools against the live Supabase DB.

## Database

Schema changes: add a new numbered file in `app/supabase/migrations/` and apply it. The **Supabase MCP server is connected** (project ref `zmdpsrbgbvwcmrwjvuzc`), so migrations can be applied and the DB inspected directly rather than asking the user to paste SQL — but **also write the SQL to a migration file** so the repo stays the source of truth. Env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` live in `app/.env.local` for local dev (gitignored) and `app/.env.production` for the build (committed — it holds only the Supabase **publishable** anon key, which ships in the client bundle anyway and is safe behind RLS). `.env.example` documents the vars.

Every table is scoped by `space_id` and guarded by RLS through the `is_space_member(space_id)` SECURITY DEFINER helper. Cross-table writes that must be atomic or bypass the insert-race (space creation, invites) are Postgres RPCs, not client-side inserts. Foreign keys must reference unique columns (a non-unique FK aborts the whole migration).

## Architecture

**Auth/space gating (`App.tsx`).** `AuthProvider` tracks the Supabase session. `SpaceProvider` resolves the user's single space membership. Three states: unauthenticated → `/login`; authenticated but no space → create-space wizard; authenticated with a space → `AppShell`.

**Data layer (`state/SpaceProvider.tsx`) is the heart of the app.** A generic `useTable<T>(table, spaceId)` loads every space-scoped table once and opens a Realtime subscription that keeps the in-memory array live (INSERT/UPDATE/DELETE reconcile locally). Components consume everything through `useSpace()` — they read already-loaded, always-current arrays and **never refetch after a write**; the realtime channel repaints them. `notifications` are loaded per-user separately. The provider also owns `activeLitterId` (the currently-focused litter) and its setter.

**Writes.** Simple single-row writes call the `supabase` client inline in the component. Anything that touches multiple tables or encodes a business rule goes through `lib/actions.ts`: cascade-on-date-change (`applyDateChange`/`previewDateChange`), `endPlan` (did-not-take), `startWhelping`/`finishWhelping`, `completeTaskWithResult` (progesterone≥18 → confirm ovulation → cascade), and `notifyMembers` (fan-out to the in-app feed).

**Scheduling engine (`lib/scheduling.ts` + `lib/dates.ts`).** Key dates form a formula chain (verified against the kennel's spreadsheet): `heat → ovulation(+13) → mating(+2) → whelping(+60) → weaning(+56)`, and `handover = whelping + 2 calendar months` (via `addMonths`, special-cased in `recomputeLitterDates`). Each date is a `{predicted, actual}` pair and **actual always wins** (`effectiveDate`). Editing an actual date `recomputeLitterDates` then cascades every non-pinned, anchor+offset task (`cascadePreview` shows the count, `applyCascade` writes). `tasksFromTemplates` expands `task_templates` into concrete task rows on litter creation. `dates.ts` does all date math on `YYYY-MM-DD` strings (mirrors the prototype exactly — don't switch to `Date` arithmetic).

**Task dependencies (`lib/dependencies.ts`).** Tasks can depend on predecessor tasks (`tasks.depends_on = [{taskId, type: 'FS'|'SS', lag}]`), independent of anchor offsets. `computeSchedule` topologically resolves start/due: FS → predecessor.due+lag, SS → predecessor.start+lag, latest across predecessors wins; `due = start + duration_days`. On litter creation, `tasksFromTemplates` rewrites template deps (`task_templates.depends_on = [{ref: <predecessor sort_order>, ...}]`) into concrete task-id links and pre-resolves dependent dates. When a litter date changes, `applyDateChange` first runs the anchor cascade (`applyCascade` skips dependent tasks), then `scheduleUpdates` re-flows the dependency graph on top. The default plan (`seed_default_templates`, migration `0005`) is the kennel's real ~51-task schedule with dependency chains (deworming #1→#5, book update→print, pedigree→docs). Visualized in the **Gantt** view (`routes/Gantt.tsx`, the LITTER nav item that replaced Calendar) as phase-colored bars + SVG elbow connectors, and as "⇢ after X / ↳ blocks Y" chips in the task detail sheet.

**Routing/UI.** `AppShell` renders the nav (desktop sidebar / mobile bottom bar) plus a nested `<Routes>`. Full pages live in `routes/`; in-context actions are bottom-sheet modals (`components/**/*Sheet.tsx`, built on `Sheet` from `components/ui/index.tsx`). Shared primitives (`Card`, `Button`, `Sheet`, `Chip`, `Avatar`, `SegmentedControl`, …) are all in `components/ui/index.tsx`. Theming is Tailwind v4 via `@theme` tokens in `src/index.css` (palette already matches the design system: `--color-accent #17805a`, `--color-app-bg #f4f3ee`, etc.).

## Conventions

- **TypeScript strict + null-narrowing gotcha:** after an early-return null-guard on `litter`/`space`/`me`, define event handlers as arrow-function `const`s, not `function` declarations. Hoisted `function` declarations are not covered by the narrowing and will error with "possibly null/undefined".
- Types in `lib/types.ts` mirror the SQL schema 1:1 — update both together.
- Money is EUR; puppy/litter naming uses the litter letter (soft warning when a puppy name doesn't start with it).

## Current vs active litters

Two distinct concepts — do not conflate them:
- **Current litter** (`activeLitterId` in `SpaceProvider`, exactly one): which litter the LITTER-scoped sidebar/screens focus on. Selected via the sidebar "CURRENT LITTER" header/switcher, the Litters "Set as current" button, or the dashboard's multi-active strip. UI labels it "Current" (the `● Current` chip). The variable name is legacy — it means *current/focused*, not *active status*.
- **Active** (`litters.is_active`, many allowed): a persisted flag toggled per-litter in the Litters screen. Active litters appear on the dashboard strip + switcher's Active group; deactivating shelves a litter (kept, reversible) into the Inactive group without closing it. Terminal statuses (`closed`/`did_not_take`) form a separate Archive group. `SpaceProvider` auto-picks the most-recent active litter as current and re-picks if the current one is deactivated.

## Navigation model

Matches the prototype. Desktop sidebar has two groups: **KENNEL** (cross-litter: Dashboard, Litters, All documents, All buyers, All expenses, My dogs) and **LITTER _X_** (current-litter scoped: **Gantt**, Tasks, Ongoing, Weigh-ins, Puppies, Documents, Buyers, Expenses), with a prominent clickable current-litter header between the groups. Mobile bottom bar is **Today · Plan · Litter · More** (each groups several routes — see `isMobileTabActive` in `AppShell.tsx`). "Buyers" = the `owners` table (People screen's owners tab / `/buyers`); "Team" (`/team`) is space members + invites. **Tasks** (`/tasks`) is `Timeline mode="list"`; **Gantt** (`/gantt`, `routes/Gantt.tsx`) is the dependency bar chart. A shared `TaskViewToggle` (List/Gantt segmented) cross-links the two. (`Timeline`'s `mode='calendar'`/`'both'` branches still exist but are no longer routed — Gantt replaced Calendar.)

## Recurrence engine ("Ongoing")

Separate from one-off tasks. `recurrence_rules` (schedule: freq/interval/times[]/start/end) fire `times[]` occurrences on every matching date; completion/skip is one row per occurrence in `rule_checks`. Pure logic in `lib/recurrence.ts` (`ruleOccursOn`, `occurrencesForDate`, `rotateAssignee` for round-robin assignees, `defaultRulesForLitter` for the weigh/box-temp/clean/socialization rules seeded on litter creation). Occurrence check-off goes through `setOccurrence` in `lib/actions.ts` (upsert/delete on the `rule_id,occ_date,occ_time` unique key). Occurrences feed the Dashboard "Today"/"Next 7 Days", the Today agenda (AM/PM slots), and the Ongoing screen. The migration is `0002_recurrence.sql`.

## Deployment

Hosted on **Vercel** (team `marty-inc`, project `breeders-app`, live at **https://breeders-app.vercel.app**), auto-deploying on every push to `main` via the GitHub integration (repo `Marty1369/Breeders_app`). Because the app is in the `app/` subfolder and the Vercel project's Root Directory is the repo root, the root **`vercel.json`** drives the build: `installCommand`/`buildCommand` use `npm --prefix app …`, `outputDirectory` is `app/dist`, and a catch-all `rewrites` rule sends non-asset paths to `/index.html` for SPA client routing (the regex excludes `assets/` and any path with a dot so the service worker + static files still resolve). The Vercel MCP is connected for inspecting deployments/build logs but has **no tool to change project settings or env vars** — that's why credentials are committed in `app/.env.production` rather than set in the dashboard. After a domain change, the live URL must be added to **Supabase → Auth → URL Configuration** (Site URL + Redirect URLs) for password-reset/invite links.

## Known state

Feature-complete against the prototype and deployed live (dashboard 6-card grid + Next 7 Days, split nav, recurrence/Ongoing, Today agenda, Tasks/Gantt, task dependencies, aggregate views + Litters screen — all built and verified against the live Supabase DB). Documents remain placeholder-styled PDFs (not pixel-matched to the kennel DOCX), notifications are in-app only (no web push), and `pdf-lib` keeps the JS bundle >500 kB (a future code-split). Litter-date changes cascade tasks (anchor + dependency re-flow) but do **not** re-anchor existing recurrence rules' start/end.
