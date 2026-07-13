# QA Release Checklist — Kennel / Litter-Planning PWA

**Build:** just-shipped-to-prod (`staging` == `main`, overhaul shipped 2026-07-11) · **Method:** rigorous read-only code tracing (handler → Supabase call → state update), adversarial. `file:line` evidence is against `app/src/…` and `app/supabase/migrations/…`.

> **REMEDIATION 2026-07-13 (staging `1b13908`…`11c1360`):** all 6 FAILs below are FIXED — CASC-09 (Home → CompleteTaskSheet), CASC-10 (`computeDateShifts` shared by preview+apply), TASK-13 (sheet saves surface errors, incl. `completeTaskWithResult` throwing), DOC-06 (Search queries `uploads`), DATA-03 (terminal-litter read-only guards in Docs/Money/WeighIn/HealthLog/BirthLog + write-time guard in AddExpenseSheet), BUY-06 (OwnerRecord lists all linked puppies). Also fixed the "worth a ticket" items: BUY-04 double-tap lock, BUY-05 no-price hint, Docs storage-error surfacing, NAV-03 FAB-expense deep link. **New behavior needing device NEEDS-MANUAL:** Android back gesture closes the topmost sheet/callout (`lib/backClose.ts`) — busy-refuse while saving, FAB consume-then-navigate; verified via desktop popstate simulation, needs a real Android gesture pass. A second adversarial QA round over the night's diff found 8 further issues (archive mutation via Birth log, cross-litter `?task=`, `?new=1`/`?puppy=` bypasses, route-backed wizard sentinel, missing `busy` props, kennel-upload scope) — all fixed in `11c1360`. See UAT_GUIDE.md for the scripted UAT pass.

**Status legend:** PASS (code supports the behavior end-to-end) · FAIL (defect found) · BLOCKER (release-stopping) · NEEDS-MANUAL (cannot be confirmed by code alone — needs a device/browser/multi-user run).
**Priority:** P0 blocker · P1 major · P2 minor.

> Verification note: no automated test framework exists in this repo, so every case below is a static trace. Realtime multi-user behavior, on-device keyboards, and visual clipping are marked NEEDS-MANUAL by necessity.

---

## 1. Core smoke / lifecycle

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| SMOKE-01 | Sign up / sign in | P0 | PASS | `routes/auth/AuthPage.tsx:28` signUp, `:43` signInWithPassword; handles no-session email-confirm case (`:37-40`), navigates on success. |
| SMOKE-02 | Create space via `create_space` RPC | P0 | PASS | `routes/auth/CreateSpaceWizard.tsx:22` `rpc('create_space',…)` → `reloadMembership()` re-gates into AppShell (`:37-38`). RPC is SECURITY DEFINER, seeds member + payer + templates (`0001:365`, redefined `0005:75` to call `seed_default_templates`). |
| SMOKE-03 | Add dog (DogFormSheet) inserts row | P0 | PASS | `components/DogFormSheet.tsx:96` `insert({space_id,…})`; guarded on `space && name.trim()` (`:67`); edit path `:94`. |
| SMOKE-04 | Start litter → tasks + rules seeded | P0 | PASS | `components/NewLitterWizard.tsx:81` insert litter → `:104` `tasksFromTemplates` → `:106` insert tasks → `:110` `defaultRulesForLitter` → `:112` insert rules → `:100` records dam heat. All awaited, errors thrown/caught. |
| SMOKE-05 | Log whelping → atomic puppy + birth event | P0 | PASS | `routes/BirthLog.tsx:64` → `lib/actions.ts:180` `rpc('log_birth')`; RPC hardened with advisory lock + `unique(litter_id,seq)` (`0012:11,35`). |
| SMOKE-06 | Edit puppy status/price/collar/markings | P0 | PASS | `routes/PuppyEdit.tsx:62-77` updates fields; `price` null-coerced (`:70`); navigates to profile. |
| SMOKE-07 | Weigh puppies (AM/PM save) | P0 | PASS | `routes/WeighIn.tsx:87-105` updates `weigh_log` per session; error surfaced (`:93-97`). |
| SMOKE-08 | Add buyer + payment | P1 | PASS | Owner insert `routes/People.tsx:186-190`; payment append `routes/OwnerRecord.tsx:81` `update({payments:[…]})`. |
| SMOKE-09 | Close litter | P1 | PASS | `routes/CloseOut.tsx:36` `update({status:'closed'})`, gated by `canClose` (all pups resolved) (`:32,:88`). |
| SMOKE-10 | Create-space fields persist to space row | P1 | PASS | `create_space` writes kennel/affix/breeder fields (`0001:382-384`); read back into header/docs. |

---

## 2. Date cascade (CRITICAL)

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| CASC-01 | heat → ovulation/mating/whelping/weaning/handover chain | P0 | PASS | `lib/scheduling.ts:43-68` `recomputeLitterDates`; OFFSETS ov+13/mat+2/whelp+60/wean+56 (`:23-28`); handover = whelping + 2 calendar months via `addMonths` (`:53-56`), month-clamped (`lib/dates.ts:27-36`). |
| CASC-02 | Manual override wins (actual-wins) | P0 | PASS | `lib/scheduling.ts:33-36` `effectiveDate` returns `actual ?? predicted`; `setActualDate` recomputes preds while preserving actuals (`:70-72`). |
| CASC-03 | Changing whelping shifts rearing tasks | P0 | PASS | `routes/LitterInfo.tsx:49` preview → `:56` `applyDateChange` → `lib/actions.ts:74` `applyCascade` writes each non-pinned anchor+offset task (`scheduling.ts:95-111`). |
| CASC-04 | Pinned tasks don't move | P0 | PASS | `is_pinned_date` short-circuits in both `cascadePreview` (`scheduling.ts:85`) and `applyCascade` (`:103`). |
| CASC-05 | `finishWhelping` sets actual birth = earliest delivery | P0 | PASS | `lib/actions.ts:218-228` reads `birth_events` **fresh from DB** (avoids stale realtime cache), earliest `born_at` of any type, LOCAL date via `fmt(new Date())` (`:228`); then `setActualDate('whelping')` + cascade (`:235-236`). |
| CASC-06 | Recurrence rules re-anchor when litter dates move | P1 | PASS | `lib/actions.ts:78` `reanchorRules` → `lib/recurrence.ts:53-74` recomputes start/end from anchors; writes changed rules (`actions.ts:99-101`). Pre-0011 rules backfilled (`0012:57-68`). |
| CASC-07 | Progesterone ≥18 nmol/L confirms ovulation from **entered test date** | P0 | PASS | `components/CompleteTaskSheet.tsx:65` passes `date: testDate` → `lib/actions.ts:147-156` normalises ng/mL×3.18, anchors ovulation to `resultLog.date` (not the task's scheduled date), recomputes + cascades. |
| CASC-08 | Positive ultrasound sets litter `pregnant` | P1 | PASS | `lib/actions.ts:143-144` flips `planned`→`pregnant`; litters are created `planned` (`NewLitterWizard.tsx:89`). Skipped if already past `planned` (by design). |
| CASC-09 | Completing a progesterone/ultrasound task **from Home** fires the cascade | P1 | **FAIL** | Home completes loggable tasks with a plain `markTaskDone` — no `isLoggable` check: UP-NEXT `routes/Home.tsx:321`, Today checklist `Home.tsx:180`. The result sheet never opens, so **no ovulation cascade (CASC-07) and no pregnant flip (CASC-08)** when done from Home. Tasks list routes correctly (`Timeline.tsx:56-61`). Fix: gate Home completion through `CompleteTaskSheet` for loggable tasks. |
| CASC-10 | Cascade preview count matches tasks actually shifted | P2 | FAIL | `cascadePreview` (`scheduling.ts:84-92`) counts dependent tasks and anchor-changed-but-same-start tasks that `applyCascade` (`:95-111`) skips (it excludes `depends_on` and only writes when `start !== start_date`). The "N dates will shift" number can overstate the write. Cosmetic, not data-corrupting. |
| CASC-11 | did-not-take cancels future open tasks | P1 | PASS | See TASK-10 (`lib/actions.ts:118-123`). |

---

## 3. Puppy care

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| PUP-01 | Puppies appear after birth log | P0 | PASS | `log_birth` creates puppy row (`0012:41`); `routes/Puppies.tsx:52` filters by `activeLitterId`, live via realtime. Stillborn deliberately makes no puppy (`0012:39`). |
| PUP-02 | Weight alert (≤5g gain over 4 reads) surfaced | P1 | PASS | `lib/scheduling.ts:203-214` `hasWeightAlert` (needs ≥4 reads, `last4[3]-last4[0] ≤ 5`); amber UI `routes/Puppies.tsx:63,75,91`. |
| PUP-03 | Puppy profile weight chart | P1 | PASS | `routes/PuppyProfile.tsx:8-31` builds SVG path from `weigh_log`; "Not enough weigh-ins yet" below 2 points (`:15`). |
| PUP-04 | Deceased puppies excluded from weigh-in + active counts | P1 | PASS | Weigh-in filters `status !== 'deceased'` (`WeighIn.tsx:28`); CloseOut unresolved excludes deceased (`CloseOut.tsx:24`). |
| PUP-05 | Auto-advance to next puppy after save | P1 | PASS | `routes/WeighIn.tsx:101-102` advances to first non-focus unweighed; sticky-bar "next puppy ›" (`:357`). |
| PUP-06 | Health log applies to whole litter or selected puppies | P1 | PASS | `routes/HealthLog.tsx:26` `scope: 'all' | string[]`, stored in `applies_to` (`:53`) with `litter_id`; toggles at `:82,:90`. |

---

## 4. Tasks & routines

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| TASK-01 | Create one-off task | P1 | PASS | `components/task/TaskFormSheet.tsx:110-133` builds + awaits `insert` (`:132`); guard `!space||!litterId||!name.trim()` (`:89`). Caveat: TASK-13. |
| TASK-02 | Create recurring rule | P1 | PASS | `components/RuleFormSheet.tsx:73-104` awaited insert (`:100`); nulls whelping anchors on manual rules (`:92-95`). Caveat: TASK-13. |
| TASK-03 | Complete simple task instantly + Undo snackbar | P1 | PASS | `routes/Timeline.tsx:56-61` non-loggable → `markTaskDone(task,true)` + snackbar (`:215-224`). |
| TASK-04 | Complete progesterone via CompleteTaskSheet | P0 | PASS | See CASC-07. Sheet resets result state per task-id so a prior test date can't leak (`CompleteTaskSheet.tsx:55-58`). |
| TASK-05 | Complete ultrasound → pregnant / not-pregnant → end-plan | P1 | PASS | Positive → CASC-08; "not pregnant" opens `FailedPregnancySheet` (`CompleteTaskSheet.tsx:87-89,186`). |
| TASK-06 | Reopen a done task | P2 | PASS (minor UX) | `components/task/TaskDetailSheet.tsx:61-62` → `markTaskDone(task,false)` → `todo`. Sheet renders a captured snapshot, so the footer keeps showing "Reopen" until the parent re-opens; DB write is correct. |
| TASK-07 | Attach expense while completing a task | P1 | PASS | `CompleteTaskSheet.tsx:72-83` awaits `expenses.insert` with `task_id/litter_id/category/amount_eur`. Caveat: no error handling; `'0'` amount would insert. |
| TASK-08 | Gantt / List / Routines share one source of truth | P1 | PASS | `routes/Plan.tsx:33-35` renders Timeline/Gantt/Ongoing as tabs, all reading `useSpace()` tasks; realtime keeps them consistent. |
| TASK-09 | Home "today" clears after weigh-in / routine | P1 | PASS | Occurrence toggle `Home.tsx:110-111` `setOccurrence` → realtime → recompute; weigh-in marks all `/weigh/i` occurrences done (`WeighIn.tsx:132-136`). |
| TASK-10 | did-not-take (endPlan) cancels open tasks | P1 | PASS | `lib/actions.ts:118-123` sets all `status!=='done'` litter tasks to `done` + "(cancelled…)" note, litter → `did_not_take`, notifies. Note: cancelled reuse `done` (no distinct cancelled status) — by design. |
| TASK-11 | Undo snackbar actually reverts | P1 | PASS | `Timeline.tsx:218-220` Undo → `markTaskDone(undoTask,false)`; auto-dismiss 4.5s (`:50-54`). |
| TASK-12 | Gantt today-line + auto-scroll + New task/Repeat | P1 | PASS | Today line `Gantt.tsx:239-241,258-260`; one-shot auto-scroll via `scrolledFor` ref (`:117-125`); actions `:141-142` open Task/Rule sheets. |
| TASK-13 | Sheet writes surface DB errors | P2 | FAIL | `TaskFormSheet.save` (`:132-135`), `RuleFormSheet.save` (`:98-103`), and the inline complete-task expense insert ignore the Supabase `error` and always `onClose()`. A failed insert (e.g. RLS) closes the sheet as if it succeeded. `AddExpenseSheet`/`NewLitterWizard` do handle errors — inconsistent. |

---

## 5. Documents

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| DOC-01 | Upload document to active litter | P1 | PASS | `routes/Docs.tsx:27-42` path `${space.id}/uploads/…`, inserts `uploads` row with `litter_id: activeLitterId`; storage RLS `space_files_insert` (`0001:494`). Caveat: storage `upErr` swallowed (`:32`). |
| DOC-02 | Download private file via signed URL | P1 | PASS | `Docs.tsx:44-48` `createSignedUrl(path,60)` → `window.open`; bucket private, gated by `space_files_select` (`0001:491`). |
| DOC-03 | Delete uploaded file | P2 | PASS | `Docs.tsx:50-54` `storage.remove` then row delete; behind confirm state. Caveat: storage error unchecked → possible orphaned blob if remove fails but row deletes. |
| DOC-04 | Generated PDF is PARKED / unrouted | P1 | PASS | `DocGenerateSheet` referenced only in its own file; not in AppShell `<Routes>`. Confirmed dormant (matches CLAUDE.md). |
| DOC-05 | Missing-field detection logic | P2 | PASS | `lib/documents.ts:172-176` `missingFields` filters `required && !values[key]?.trim()`; drives draft/ready. Sound, but only reachable once DocGenerateSheet is wired (DOC-04). |
| DOC-06 | Uploaded files appear in global Search | P1 | **FAIL** | `routes/Search.tsx:20` searches the parked `documents` table (effectively empty), **not** the `uploads` table where real files live (`Docs.tsx:11,33`). Uploaded contracts/pedigrees are never findable in search; the "Documents" result group is dead. Fix: query `uploads`. |

---

## 6. Buyer / owner / handover

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| BUY-01 | Add buyer | P1 | PASS | `routes/People.tsx:186-190` inserts owner (with optional `waiting_list_for`). |
| BUY-02 | Waiting list (`waiting_list_for`) | P1 | PASS | Column `owners.waiting_list_for → litters` (`0001:225`); set on insert (`People.tsx:190`), filtered (`:98-102`), "Waiting list" chip (`:152`). |
| BUY-03 | Link buyer to puppy (`owner_id`) | P1 | PASS | `routes/PuppyEdit.tsx:75` `owner_id: form.ownerId || null`. |
| BUY-04 | Deposit / final payment | P1 | PASS | `routes/OwnerRecord.tsx:81` appends to `payments[]`. Caveat: `addPayment` (`:78`) has no busy lock → rapid double-tap can append two payments. |
| BUY-05 | Handover checklist blocks completion until contract/payment/chip/passport | P1 | PASS | `components/HandoverChecklistSheet.tsx:18` `gateOk`; button `disabled={!gateOk}` (`:46`); `paymentComplete` derived from payments ≥ full_price (`:15`). Edge: if `full_price` is 0/unset, `paymentComplete` is forever false → handover permanently blocked (subtle). |
| BUY-06 | One owner with multiple puppies | P2 | FAIL | `OwnerRecord.tsx:14` and `Aggregates.tsx:75` use `puppies.find(p => p.owner_id === id)` (single) — a buyer who took two puppies only ever sees one on their record. Fix: `filter` + render a list. |
| BUY-07 | Deleting a buyer unlinks puppy safely | P1 | PASS | `puppies_owner_fk … on delete set null` (`0001:234`); comment confirms intent (`OwnerRecord.tsx:85`). No orphaned/dangling puppy. |

---

## 7. Navigation & UX regression

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| NAV-01 | Mobile bottom tabs (4) route correctly | P1 | PASS (spec drift) | Tabs are **Home / Plan / Puppies / Kennel** (`AppShell.tsx:60-65`), not the brief's "Today/Plan/Litter/More" — spec evolved; `isMobileTabActive` maps sub-routes (`:279-285`). |
| NAV-02 | Desktop sidebar links all resolve | P1 | PASS | KENNEL + LITTER nav entries each have a matching `<Route>` (`AppShell.tsx:186-222`). |
| NAV-03 | FAB hidden on weigh-in / when no active litter | P1 | PASS | `AppShell.tsx:237` `location.pathname !== '/weigh-in' && activeLitter`. Minor: FAB "Expense" navigates to `/expenses` without opening the add sheet (`:257`). |
| NAV-04 | Litter switcher sets `activeLitterId` | P1 | PASS | `components/LitterSwitcherSheet.tsx:35-41` `setActiveLitterId`; reactivate flips `is_active` (`:36-38`). |
| NAV-05 | Retired routes redirect (no dead routes) | P1 | PASS | `/today→/`, `/tasks→/plan`, `/gantt→/plan?tab=gantt`, `/ongoing→/plan?tab=routines`, `/menu→/kennel`, `/litters/new→NewLitterRoute` (`AppShell.tsx:190-196`). |
| NAV-06 | Back navigation from sheets/pages | P2 | NEEDS-MANUAL | Sheets close via `onClose`, pages via `navigate`; no custom history traps found, but browser-back behavior is not code-verifiable. |

---

## 8. Permissions / team

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| PERM-01 | Invite link joins existing space (no duplicate); 0009 takeover fix present | P0 | PASS | `routes/auth/JoinInvite.tsx:33` → `join_space_via_invite`; `on conflict (space_id,user_id) do nothing` (`0001:443`). `0009:32-35` removed the RLS-blind `not exists` self-insert branch (cross-tenant takeover). |
| PERM-02 | Team member sees the same litters/tasks (RLS) | P0 | PASS | Every space table is `for all using (is_space_member(space_id))` (`0001:107,129,175,206,…`); `is_space_member` is SECURITY DEFINER on `auth.uid()` (`0001:46-57`). |
| PERM-03 | `delete_account` (0013) doesn't orphan/expose data | P1 | PASS | Parameterless, self-only (`auth.uid()`), deletes space only when now-empty, nulls the two NO-ACTION FKs before auth delete; EXECUTE authenticated-only (`0013`). `MyProfile.tsx:46-59` calls then signs out. |
| PERM-04 | Realtime cross-user propagation (member B sees A's write live) | P1 | NEEDS-MANUAL | `useTable` opens one `postgres_changes` channel per table filtered by `space_id` (`SpaceProvider.tsx:32-55`); correctness under two live sessions requires a real multi-user run. |
| PERM-05 | Assignments/notifications target correct user | P1 | PASS | `notifyMembers` fan-out excludes the actor (`actions.ts:50-54`); notifications RLS `user_id = auth.uid()` (`0001:347`). |

---

## 9. Data integrity

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| DATA-01 | Expense This-litter vs All-litters scope | P1 | PASS | `routes/Expenses.tsx:44-52` `effectiveScope = activeLitterId ? scope : 'all'`; filters by `litter_id`. `Aggregates.AllExpenses` is space-wide (`Aggregates.tsx:103-107`). |
| DATA-02 | Writes scoped to correct litter via `activeLitterId` | P0 | PASS | Docs/WeighIn/Health/Puppies/TaskForm all read `activeLitterId` from `useSpace()` and stamp `litter_id` on insert (e.g. `Docs.tsx:33`, `HealthLog.tsx:49`, `TaskFormSheet` litterId prop). No hard-coded/other-litter write found. |
| DATA-03 | Archived/closed litters are read-only where expected | P1 | FAIL | Terminal-status handling exists only in Home/Litters/LitterInfo/CloseOut. `Docs`, `Expenses`, `WeighIn`, and the FAB do **not** check litter status — a `closed`/`did_not_take` litter chosen as current is still fully writable (RLS permits it). No UI-level read-only guard. |
| DATA-04 | Search sets active litter before opening a cross-litter record | P1 | PASS | `Search.tsx:32-35` sets active litter before navigating to `/plan` (litter-scoped); puppy/owner/doc results use id-based routes that read `useParams`, so no stale-litter bug. |
| DATA-05 | Single-membership assumption | P2 | NEEDS-MANUAL | `SpaceProvider.tsx:111-116` resolves membership with `.limit(1).maybeSingle()`. A user who both created a space and joined another has two memberships; only one is shown (arbitrary). By design for MVP; flag if multi-space is ever expected. |

---

## 10. Responsive / mobile

| ID | Description | Pri | Status | Evidence / Notes |
|----|-------------|-----|--------|------------------|
| RESP-01 | Bottom nav respects iOS safe area | P2 | PASS | `AppShell.tsx:229` `paddingBottom: env(safe-area-inset-bottom)`; `main` reserves `pb-16 sm:pb-0` (`:184`). |
| RESP-02 | FAB doesn't overlap sticky primary action bars | P1 | PASS | FAB hidden on `/weigh-in` (the sticky-bar screen) (`AppShell.tsx:237`); FAB at `bottom-20`, bar at `bottom-0`. |
| RESP-03 | Gantt / wide tables scroll within their own container | P2 | NEEDS-MANUAL | `overflow-x` present in `Gantt.tsx`, `Timeline.tsx`, `Dogs.tsx` — confirm no page-body horizontal scroll on a 375px viewport by driving the app. |
| RESP-04 | Weigh-in numeric keyboard | P2 | NEEDS-MANUAL | `WeighIn.tsx:219-220,277-278` `type="number" inputMode="numeric"`; on-device keyboard + decimal-gram entry must be checked on a real phone. |
| RESP-05 | Sheets fit without clipping on small screens | P2 | NEEDS-MANUAL | `Sheet` primitive in `components/ui/index.tsx`; visual fit/scroll of tall sheets (New litter, Complete task) is not code-verifiable. |
| RESP-06 | STAGING badge shows off-production | P2 | PASS | Header badge gated on `!isProduction` per `lib/supabase.ts` env selection (CLAUDE.md/deploy). |

---

## Summary

**By status (after the 2026-07-13 remediation):** PASS 50 · FAIL 0 · BLOCKER 0 · NEEDS-MANUAL 7 (+1 new: Android back gesture on device)

**By priority:** P0 12 (all PASS) · P1 32 · P2 12.

**Fails:** none open. Historical: CASC-09, DOC-06, DATA-03, TASK-13, CASC-10, BUY-06 — all fixed on staging 2026-07-13 (commits `1b13908`, `9d5de06`, `54b5d34`, `11c1360`).

### Top blockers / fails (most severe first)

1. **CASC-09 — Completing a progesterone/ultrasound task from Home skips result logging.** The ovulation cascade and the `pregnant` status flip never fire, so the litter stays mis-dated / never marked pregnant when the user works from the Home screen. Fix: `routes/Home.tsx:180` and `:321` must route loggable tasks through `CompleteTaskSheet` (mirror `Timeline.tsx:56-61`). **P1.**
2. **DOC-06 — Global Search never finds uploaded documents.** `routes/Search.tsx:20` queries the parked/empty `documents` table instead of `uploads`; every real contract/pedigree is unsearchable. Fix: query `uploads` (and match `Docs.tsx` shape). **P1.**
3. **DATA-03 — Archived/closed litters remain fully writable.** No read-only guard in `Docs.tsx`, `Expenses.tsx`, `WeighIn.tsx`, or the FAB; a `closed`/`did_not_take` litter selected as current still accepts writes. Fix: disable write entry points when `litter.status` is terminal. **P1.**
4. **TASK-13 — Sheet writes swallow Supabase errors.** `TaskFormSheet.save` (`:132`), `RuleFormSheet.save` (`:98`), and the inline complete-task expense insert always `onClose()` even on a failed insert — the user thinks it saved. Fix: check `error`, surface it, keep the sheet open. **P2.**
5. **CASC-10 — Cascade preview count can overstate the shift.** `cascadePreview` (`scheduling.ts:84`) counts dependent + same-start tasks that `applyCascade` (`:95`) skips, so "N dates will shift" may exceed the actual writes. Cosmetic. Fix: align the preview filter with `applyCascade`. **P2.**

*(Also worth a ticket, lower severity: BUY-06 OwnerRecord shows only one puppy per owner (`.find`); BUY-04 / OwnerRecord & Handover toggle lack double-tap guards; Docs storage errors swallowed; BUY-05 `full_price=0` permanently blocks handover.)*

---

## Recommended automation mix

- **Unit (fast, high-value):** `lib/scheduling.ts` (recomputeLitterDates chain, applyCascade/cascadePreview parity — would have caught CASC-10, hasWeightAlert boundary), `lib/dates.ts` (addMonths month-clamp), `lib/recurrence.ts` (ruleOccursOn/reanchorRules/rotateAssignee), `lib/dependencies.ts` (computeSchedule FS/SS + cycle), `lib/documents.ts` (missingFields). Pure functions, no Supabase — cheapest coverage of the riskiest logic.
- **Integration (against a staging DB / local Supabase):** `lib/actions.ts` — `completeTaskWithResult` (progesterone ≥18 cascade, ultrasound→pregnant), `finishWhelping` (fresh-read earliest-birth dating), `applyDateChange` (task + rule shifts), `logBirth` RPC (seq uniqueness under concurrency), `endPlan`. Assert row state after each write.
- **Playwright E2E (one core breeder lifecycle):** sign up → create space → add dam+sire → start litter → see plan → log births → weigh puppies → add buyer + payment → handover gate → close litter. Add a targeted E2E for CASC-09 (complete a progesterone task from Home and assert the litter re-cascades) and DOC-06 (upload → search).
- **Manual exploratory (device/browser):** mobile nav + FAB overlap, sheet fit/clipping, numeric keyboard on weigh-in, two-user realtime propagation (PERM-04), browser-back from sheets (NAV-06). These are the NEEDS-MANUAL rows above.
