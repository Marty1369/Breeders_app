---
name: kennel-breeding-app
description: >-
  Domain knowledge and architecture patterns for building dog kennel / breeding
  management software — litter planning, heat & whelping tracking, puppy-rearing
  task schedules, pedigree/registry records, buyers & handover, and team-shared
  kennel data. Use this whenever the user is building or extending an app for dog
  (or cat) breeders, kennels, catteries, studs, litters, whelping, or puppy
  management — even when they only describe the workflow ("track my bitch's heat
  cycle", "auto-schedule puppy vaccinations and deworming", "manage a litter of
  puppies from birth to handover", "when should the pups get microchipped")
  without naming a "kennel app". Reach for it before hand-rolling breeding dates,
  litter data models, or rearing checklists from scratch.
---

# Building dog kennel / breeding management apps

Breeding software looks like a generic task app until you hit the domain: every
date is derived from a biological event that can slip, one litter is run by a
whole team, and the "tasks" are a fixed rearing protocol with real dependencies
between them. Getting the **date model** and the **entity model** right up front
is what separates an app breeders actually use from a to-do list they abandon.

This skill captures a proven design (verified against a real kennel's production
spreadsheet). Adapt it — don't copy blindly — but the formulas, the entity
relationships, and the gotchas below are hard-won and worth honoring.

## The one idea that shapes everything: predicted vs. actual dates

A litter's whole timeline hangs off a chain of key dates, each **computed** from
the previous one — but any of them can be **observed** and overridden when it
actually happens (the bitch whelped a day early; ovulation was confirmed late).

Model every key date as a pair `{ predicted, actual }` and make **actual always
win** when both exist. When a user enters an actual date, recompute the
downstream predicted dates and **cascade** every task anchored to them. This is
the single most important pattern; if you skip it, users will fight the app
every time biology doesn't match the calendar.

```
effectiveDate = actual ?? predicted
```

### Key-date formula chain (verified offsets)

```
heat (observed, the anchor)
  → ovulation  = heat + 13 days        (confirmed by progesterone ≥ ~18 nmol/l)
  → mating     = ovulation + 2 days    ("15th day" / 2nd mating)
  → whelping   = mating + 60 days      (≈ heat + 75; range 59–63 in practice)
  → weaning    = whelping + 56 days    (8 weeks)
  → handover   = whelping + 2 calendar months   (use month math, NOT +60 days)
next heat (per dog) = last heat start + ~6 months   (drives "heat watch" reminders)
```

Handover is a **calendar-month** add (e.g. Jul 3 → Sep 3), so compute it with a
month function, not a day offset — the off-by-one that day-math introduces is
exactly the kind of thing breeders notice.

Do all date math on `YYYY-MM-DD` strings with small pure helpers (add days, add
months, diff days), not `Date` arithmetic — you avoid timezone drift and the code
reads like the breeder's mental model.

## Tasks: templated, anchored, and dependent

A new litter should **auto-generate its whole rearing plan** the moment it's
created — breeders will not enter ~50 tasks by hand. Store a reusable
**template plan** per kennel and instantiate it against the new litter's dates.

Each task carries:
- an **anchor + offset** (`whelping + 10`, `heat + 0`, …) so it re-flows when the
  anchor date changes, plus a **pin** flag for the rare fixed-date task that must
  not move;
- a **duration** (many rearing activities are multi-day spans, not points — "goat
  milk supplementation, days 0–20"), which matters for any Gantt/bar view;
- optional **dependencies on other tasks**, because the real protocol chains
  tasks together, e.g.:
  - *weigh 1×/day* starts the day after *weigh 2×/day* **ends** (finish-to-start),
  - *deworming #2* is *deworming #1* **+10 days** (start-to-start), and so on for
    #3→#4→#5,
  - *book printing* starts N days after *book update* **finishes**.

Support two dependency types — **FS** (successor.start = predecessor.due + lag)
and **SS** (successor.start = predecessor.start + lag) — and resolve dates
**topologically**: anchored tasks are fixed points, dependent tasks re-flow off
their predecessors, and a litter-date change first cascades the anchored tasks
then re-flows the dependency graph on top. Visualize the links (Gantt connector
lines or "after X (+N)" chips) so the plan is legible, not a flat list.

The full default rearing schedule — ~50 tasks across four phases (pre-whelp →
birth → weaning → socialization) with the real dependency chains and offsets — is
in **`references/rearing-schedule.md`**. Read it when you need concrete tasks,
phase boundaries, or the deworming/document chains.

## Recurring chores are a separate system

Daily/twice-daily jobs — **weigh the whole litter AM & PM**, box-temperature
checks, cleaning, 15-min socialization handling, heat-watch checks — are NOT
one-off tasks. Model them as **recurrence rules** (frequency, times-of-day[],
start, end condition of `never | on-date | on-key-date | after-N`, rotating
assignees) that fire **occurrences**, and track completion as one row per
occurrence (rule × date × time-slot). This keeps "today's 4 weigh-ins" out of the
one-off task list and lets you rotate whose turn it is. End conditions often
reference a key date ("weigh until weaning"), so they must re-evaluate when dates
cascade.

## Entity model (the relationships that aren't obvious)

- **Space / kennel** — the tenant. Everything is scoped to it; a breeding
  operation is a *team*, not one user. Members are equal by default (leave a role
  field for later RBAC). Invite by rotating link.
- **Dog** (first-class, not a text name) — dam/sire with `sex`, breed, DOB,
  registry no., microchip, **genetics[]** (test → result, some "by parentage"),
  hip/elbow scores, **heats[]** (drives next-heat prediction), and an
  `is_external` flag for visiting studs (with external-owner contact). Litters
  **reference dog records** so genetics/registry prefill and heat history is real.
- **Litter** — code/letter, dam→Dog, sire→Dog, status
  (`planned → pregnant → born → closed`, plus the sad path `did_not_take`), the
  key-date pairs, and a whelping log (born/stillborn entries). Support **multiple
  simultaneously-active litters** (several pregnant bitches) and keep "which
  litter am I viewing" (current/focus) separate from "is this litter active"
  (a status many can share).
- **Puppy** — name (+ litter-affix; soft-warn if the name doesn't start with the
  litter letter), sex, color, birth weight, **weigh log** (per day, AM/PM),
  microchip, registry no., genetics, `status`
  (`available → reserved → coowned → export → deceased`; deceased is *kept* but
  excluded from counts), and a **handover gate** (contract signed · payment
  complete · chip registered · passport given — all four required before "handed
  over").
- **Owner / buyer** — a *contact record*, not an app user (never notified in an
  MVP). Reusable across litters; tracks payments[] (deposit/final) vs. full price,
  handover date, waiting-list membership.
- **Health entry** — vaccination/deworming/vet-check applied to all or specific
  puppies; renders into a per-puppy vet-passport annex.
- **Expense** — per-litter, category (vet/tests/travel/food/mating/documents/
  supplies/…), payer (shared editable dropdown), optional receipt + task link.
  Aggregate to cost-per-puppy and spent-vs-received at close-out.
- **Document** — generated contract (sale, co-ownership, export, mating) prefilled
  from litter + puppy + owner + kennel data. Treat generated docs as **immutable,
  view-only** renders: to change data, fix the record and regenerate — never edit
  inside the document.

## Architecture patterns that pay off

- **Multi-tenant with row-level security** keyed on space membership. Put a
  `is_member(space_id)` check behind every table's policies. Cross-table or
  race-prone writes (create-space-and-first-member, join-via-invite) belong in
  server-side transactions/RPCs, not client round-trips.
- **Realtime shared state.** A kennel team watches the same litter; load each
  space-scoped table once and subscribe to live changes so teammates' updates
  appear without refetching after writes.
- **Notifications mirror an event model**, not ad-hoc pushes: `assigned`, `due`,
  `overdue`, `milestone` (N days before a key date), `weight_alert`,
  `plan_shift` (on cascade), `heat_watch`, `whelping_started`, `litter_cancelled`.
  Even if you only build an in-app feed first, name the events now.
- **Night-friendly modes** for the two screens used at 3 a.m. and one-handed —
  the **whelping birth log** and **weigh-in** — big targets, dark theme, numpad,
  auto-advance, and an **offline queue** that syncs on reconnect.

## Domain gotchas worth pre-empting

- **Flat-weight alert:** notify the team when a puppy gains ≤ ~5 g over 4
  consecutive weigh-ins — early fading-puppy detection is a headline feature.
- **Litter-letter naming:** many registries expect every pup in a litter to share
  a starting letter; warn softly, don't block.
- **Sad paths are first-class:** `did_not_take` (cancel open tasks, **keep**
  expenses, log the heat, predict next heat), stillborn birth-log entries, and
  `deceased` puppies (record retained, excluded from counts). Breeders live these;
  an app that can't represent them feels naive.
- **Handover is a gate, not a button:** block "handed over" until the four
  checklist items are complete; close-out requires every puppy resolved
  (handed over or deceased) and shows spent-vs-received before archiving read-only.
- **Registry/vocabulary is regional.** Terms like affix, LŠVK (Lithuania), pedigree
  order, and export paperwork vary by country/kennel club — keep them as
  configurable data, not hardcoded strings, and localize task names.

## Glossary

- **Dam / sire** — mother / father of a litter. **Bitch** — female dog.
- **Heat / season / oestrus** — the fertile cycle; its start date anchors planning.
- **Whelping** — giving birth. **Whelping box** — the birthing nest.
- **Weaning** — transition off mother's milk (~8 weeks / birth + 56 d).
- **Affix / kennel name** — the breeder's registered prefix/suffix on pedigree names.
- **Stud / stud service** — a male used for mating, often external ("visiting stud").
- **Progesterone test** — times ovulation; ≥ ~18 nmol/l confirms it.
- **Co-ownership** — shared ownership contract (breeder retains rights).
- **Socialization / neurostimulation (ENS)** — structured early puppy handling.
- **Handover** — the day a puppy goes to its buyer with contract, chip, passport.

## Building it

If you're scaffolding fresh, a fast, proven stack is **React + TypeScript + Vite**
front end on **Supabase** (Postgres + Auth + Realtime + Storage) with RLS —
it gives you the multi-tenant realtime team model almost for free. But the value
of this skill is the *domain*, not the stack: whatever you build on, get the
predicted/actual date pairs, the templated + dependent tasks, the recurrence
rules, and the entity relationships right first.
