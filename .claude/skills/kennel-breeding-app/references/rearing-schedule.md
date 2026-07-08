# Default puppy-rearing schedule (reference)

A concrete, breeder-validated task plan for one litter, from pre-mating to
handover. Offsets are days relative to an **anchor** key date (see the formula
chain in SKILL.md). `dur` = duration in days (0 = a point-in-time task). `dep` =
task-to-task dependency: `FS` (start after predecessor finishes + lag) or `SS`
(start when predecessor starts + lag).

Instantiate these against a litter's actual/predicted dates on creation, resolve
dependencies topologically, and let them cascade when a date changes. Names below
are shown in English with the original Lithuanian in parentheses where the source
plan used it — localize as needed.

Weighing (2×/day then 1×/day) and box-temperature/cleaning/socialization-handling
are **recurrence rules**, not one-off tasks — see SKILL.md. They're omitted here.

## Phase 1 — Pre-whelp (`prewhelp`)

| Task | anchor+offset | dur | dep |
|------|---------------|-----|-----|
| Folic acid (Folio rūgštis) | heat +0 | 60 | |
| Mating (Kergimas) | mating +0 | 1 | |
| Ultrasound / pregnancy check (Echoskopas) | mating +28 | 2 | |
| Mother's puppy food (Mamai puppy maistas) | whelping −29 | 30 | |
| Whelping box prep (Vados dėžė) | whelping −7 | 4 | |
| X-ray — expected count (Rentgenas) | whelping −4 | 1 | |
| Meds: calcium, clamps, oxytocin | whelping −3 | 1 | SS after X-ray +1 |
| Supplies: pads, scissors, enema | whelping −1 | 1 | |
| Supplies: gloves, whelping journal | whelping −2 | 0 | |
| Night watch / monitoring (Budėjimas) | whelping −2 | 6 | |

## Phase 2 — Birth / first trimester (`t1_birth`)

| Task | anchor+offset | dur | dep |
|------|---------------|-----|-----|
| **Whelping / birth (Gimdymas)** | whelping +0 | 1 | |
| Calcium for dam (Kalcis Mamai) | whelping +0 | 25 | |
| Unlimited food for dam | whelping +0 | 20 | |
| Goat-milk supplementation | whelping +0 | 20 | |
| Reserve temperament-test date | whelping +1 | 1 | |
| Co-owner mating permission | whelping +1 | 2 | |
| Notify kennel club of litter | whelping +2 | 2 | |
| Early neurostimulation (ENS) | whelping +3 | 14 | |
| Reserve microchips | whelping +3 | 3 | |
| Send genetics samples | whelping +4 | 3 | |
| **Deworming #1** | whelping +10 | 1 | |
| Announce litter (Vados fakto paskelbimas) | whelping +12 | 2 | |

## Phase 3 — Weaning / second trimester (`t2_wean`)

| Task | anchor+offset | dur | dep |
|------|---------------|-----|-----|
| Order puppy food | whelping +15 | 1 | |
| Socialization — touch | whelping +17 | 15 | |
| First lapping (Pirmas palakimas) | whelping +20 | 3 | |
| First soaked food | whelping +20 | 3 | |
| **Deworming #2** | whelping +20 | 1 | SS after Deworming #1 +10 |
| Order pedigree documents | whelping +22 | 3 | |
| Puppy box to porch/veranda | whelping +25 | 3 | |
| Socialization — sounds | whelping +28 | 35 | |
| Socialization — handling/exam | whelping +28 | 35 | |
| Move puppies (Šuniukų perkėlimas) | whelping +30 | 1 | |
| Registration book — update | whelping +30 | 14 | |
| **Deworming #3** | whelping +30 | 1 | SS after Deworming #2 +10 |

## Phase 4 — Socialization / third trimester (`t3_social`)

| Task | anchor+offset | dur | dep |
|------|---------------|-----|-----|
| Stop milk (Pieno nutraukimas) | whelping +32 | 2 | SS after Deworming #3 +2 |
| Collars & leashes | whelping +38 | 1 | |
| **Deworming #4** | whelping +40 | 1 | SS after Deworming #3 +10 |
| **Deworming #5** | whelping +47 | 1 | SS after Deworming #4 +7 |
| Temperament test | whelping +49 | 1 | |
| Microchip redirect from kennel club | whelping +50 | 1 | SS after pedigree order +28 |
| Registration book — print | whelping +50 | 8 | FS after book update +6 |
| Contract preparation | whelping +51 | 9 | |
| Filed marking certificates to kennel club | whelping +52 | 2 | |
| Puppy food — small take-home packs | whelping +55 | 1 | |
| Receive documents from kennel club | whelping +57 | 3 | SS after pedigree order +35 |
| Puppy vaccinations | whelping +57 | 1 | |
| Microchipping | whelping +57 | 1 | |
| Passports issued | whelping +57 | 1 | |
| Goodie bags / folders prep | whelping +57 | 4 | |
| **Handover — puppies leave (Šuniukų iškeliavimas)** | whelping +62 | 6 | |
| Litter group chat / follow-up | whelping +62 | 3 | |

## Dependency chains to notice

- **Deworming ladder:** #1 (whelping+10) → #2 → #3 → #4 → #5, each ~+7–10 days off
  the previous — a classic SS chain. When birth slips, the whole ladder moves.
- **Document pipeline:** order pedigree → microchip redirect (+28) and receive docs
  (+35); book update → book print (FS +6). These gate the handover paperwork.
- **Handover cluster** (~week 8+): vaccinations, microchipping, passports, and
  goodie bags all land together just before the puppies leave.

## Anchoring guidance

Anchor pre-mating tasks to **heat** or **mating** (they precede whelping by ~75
days, so anchoring them to whelping with a large negative offset is brittle).
Anchor everything from birth onward to **whelping** with a positive offset equal
to "days from birth" — that's the anchor breeders actually set when the litter is
born, and it makes the post-birth cascade trivial.
