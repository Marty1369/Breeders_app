-- Litter Planner — replace the generic default plan with the kennel's real
-- rearing schedule ("Vados auginimo grafikas"): ~50 tasks with phases, anchors,
-- offsets, durations, and task-to-task dependency chains (deworming, docs).
-- Weighing stays as recurrence rules. Apply after 0004.

create or replace function seed_default_templates(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from task_templates where space_id = p_space_id;

  insert into task_templates (space_id, name, phase, anchor, offset_days, duration_days, sort_order, depends_on) values
    -- PRE-WHELP
    (p_space_id, 'Folio rūgštis', 'prewhelp', 'heat', 0, 60, 10, '[]'),
    (p_space_id, 'Kergimas', 'prewhelp', 'mating', 0, 1, 20, '[]'),
    (p_space_id, 'Echoskopas', 'prewhelp', 'mating', 28, 2, 30, '[]'),
    (p_space_id, 'Mamai puppy maistas', 'prewhelp', 'whelping', -29, 30, 40, '[]'),
    (p_space_id, 'Vados dėžė', 'prewhelp', 'whelping', -7, 4, 50, '[]'),
    (p_space_id, 'Rentgenas', 'prewhelp', 'whelping', -4, 1, 60, '[]'),
    (p_space_id, 'MED. Kalcis, užspaustukai, oksitocinas', 'prewhelp', 'whelping', -3, 1, 70, '[{"ref":60,"type":"SS","lag":1}]'),
    (p_space_id, 'Priemonės: palos, žirklės, klizma', 'prewhelp', 'whelping', -1, 1, 80, '[]'),
    (p_space_id, 'Priemonės: pirštinės, registr. žurnalas', 'prewhelp', 'whelping', -2, 0, 90, '[]'),
    (p_space_id, 'Budėjimas / stebėjimas', 'prewhelp', 'whelping', -2, 6, 100, '[]'),
    -- T1 — BIRTH / FIRST TRIMESTER
    (p_space_id, 'Gimdymas', 't1_birth', 'whelping', 0, 1, 110, '[]'),
    (p_space_id, 'Kalcis Mamai', 't1_birth', 'whelping', 0, 25, 120, '[]'),
    (p_space_id, 'Neribotas maistas mamai', 't1_birth', 'whelping', 0, 20, 130, '[]'),
    (p_space_id, 'Primaitinimas ožkos pienu', 't1_birth', 'whelping', 0, 20, 140, '[]'),
    (p_space_id, 'Rezervuoti temperamento testo datą', 't1_birth', 'whelping', 1, 1, 150, '[]'),
    (p_space_id, 'Bendrasavininko leidimas kergti', 't1_birth', 'whelping', 1, 2, 160, '[]'),
    (p_space_id, 'Informuoti VŠMB apie vadą', 't1_birth', 'whelping', 2, 2, 170, '[]'),
    (p_space_id, 'Šuniukų neurostimuliacija', 't1_birth', 'whelping', 3, 14, 180, '[]'),
    (p_space_id, 'Rezervuoti čipus', 't1_birth', 'whelping', 3, 3, 190, '[]'),
    (p_space_id, 'Siųsti genetiką', 't1_birth', 'whelping', 4, 3, 200, '[]'),
    (p_space_id, '1 Nukirminimas', 't1_birth', 'whelping', 10, 1, 210, '[]'),
    (p_space_id, 'Vados fakto paskelbimas', 't1_birth', 'whelping', 12, 2, 220, '[]'),
    -- T2 — WEANING / SECOND TRIMESTER
    (p_space_id, 'Užsakyti puppy maistą', 't2_wean', 'whelping', 15, 1, 230, '[]'),
    (p_space_id, 'Socializacija - lietimas', 't2_wean', 'whelping', 17, 15, 240, '[]'),
    (p_space_id, 'Pirmas palakimas', 't2_wean', 'whelping', 20, 3, 250, '[]'),
    (p_space_id, 'Pirmas brinkintas maistas', 't2_wean', 'whelping', 20, 3, 260, '[]'),
    (p_space_id, '2 Nukirminimas', 't2_wean', 'whelping', 20, 1, 270, '[{"ref":210,"type":"SS","lag":10}]'),
    (p_space_id, 'Kilmės dokumentų užsakymas', 't2_wean', 'whelping', 22, 3, 280, '[]'),
    (p_space_id, 'Šuniukų boksas verandoje', 't2_wean', 'whelping', 25, 3, 290, '[]'),
    (p_space_id, 'Socializacija - garsai', 't2_wean', 'whelping', 28, 35, 300, '[]'),
    (p_space_id, 'Socializacija - apžiūra', 't2_wean', 'whelping', 28, 35, 310, '[]'),
    (p_space_id, 'Šuniukų perkėlimas', 't2_wean', 'whelping', 30, 1, 320, '[]'),
    (p_space_id, 'Knygos atnaujinimas', 't2_wean', 'whelping', 30, 14, 330, '[]'),
    (p_space_id, '3 Nukirminimas', 't2_wean', 'whelping', 30, 1, 340, '[{"ref":270,"type":"SS","lag":10}]'),
    -- T3 — SOCIALIZATION / THIRD TRIMESTER
    (p_space_id, 'Pieno nutraukimas', 't3_social', 'whelping', 32, 2, 350, '[{"ref":340,"type":"SS","lag":2}]'),
    (p_space_id, 'Antkakliai ir pavadžiai', 't3_social', 'whelping', 38, 1, 360, '[]'),
    (p_space_id, '4 Nukirminimas', 't3_social', 'whelping', 40, 1, 370, '[{"ref":340,"type":"SS","lag":10}]'),
    (p_space_id, '5 Nukirminimas', 't3_social', 'whelping', 47, 1, 380, '[{"ref":370,"type":"SS","lag":7}]'),
    (p_space_id, 'Temperamento testas', 't3_social', 'whelping', 49, 1, 390, '[]'),
    (p_space_id, 'Cipavimo nukreipimas iš VŠMB', 't3_social', 'whelping', 50, 1, 400, '[{"ref":280,"type":"SS","lag":28}]'),
    (p_space_id, 'Knygos spausdinimas', 't3_social', 'whelping', 50, 8, 410, '[{"ref":330,"type":"FS","lag":6}]'),
    (p_space_id, 'Sutarties parengimas', 't3_social', 'whelping', 51, 9, 420, '[]'),
    (p_space_id, 'Užpildytų ženkl. paž. pat. VŠMB', 't3_social', 'whelping', 52, 2, 430, '[]'),
    (p_space_id, 'Puppy maisto mažos pakuotės', 't3_social', 'whelping', 55, 1, 440, '[]'),
    (p_space_id, 'Dokumentų gavimas (VŠMB)', 't3_social', 'whelping', 57, 3, 450, '[{"ref":280,"type":"SS","lag":35}]'),
    (p_space_id, 'Šuniukų skiepai', 't3_social', 'whelping', 57, 1, 460, '[]'),
    (p_space_id, 'Čipavimas', 't3_social', 'whelping', 57, 1, 470, '[]'),
    (p_space_id, 'Pasų gavimas', 't3_social', 'whelping', 57, 1, 480, '[]'),
    (p_space_id, 'Lauknešėlių ir papkių ruošimas', 't3_social', 'whelping', 57, 4, 490, '[]'),
    (p_space_id, 'Šuniukų iškeliavimas', 't3_social', 'whelping', 62, 6, 500, '[]'),
    (p_space_id, 'Vados čatas', 't3_social', 'whelping', 62, 3, 510, '[]');
end;
$$;

-- Point create_space at the shared seeder instead of its old inline plan.
create or replace function create_space(
  p_name text, p_kennel_name text, p_affix text, p_breeder_name text,
  p_breeder_address text, p_breeder_phone text, p_breeder_email text, p_member_name text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_space_id uuid;
begin
  insert into spaces (name, kennel_name, affix, breeder_name, breeder_address, breeder_phone, breeder_email)
  values (p_name, p_kennel_name, p_affix, p_breeder_name, p_breeder_address, p_breeder_phone, p_breeder_email)
  returning id into v_space_id;

  insert into space_members (space_id, user_id, name, email)
  values (v_space_id, auth.uid(), p_member_name, (select email from auth.users where id = auth.uid()));

  insert into payers (space_id, label) values (v_space_id, 'Cash');

  perform seed_default_templates(v_space_id);
  return v_space_id;
end;
$$;
