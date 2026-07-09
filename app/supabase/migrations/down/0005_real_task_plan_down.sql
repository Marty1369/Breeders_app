-- Revert 0005: drop the seeder and restore create_space's original inline plan
-- (the version defined in 0001). Existing task_templates rows are left as-is.
drop function if exists seed_default_templates(uuid);

create or replace function create_space(
  p_name text, p_kennel_name text, p_affix text, p_breeder_name text,
  p_breeder_address text, p_breeder_phone text, p_breeder_email text, p_member_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_space_id uuid;
begin
  insert into spaces (name, kennel_name, affix, breeder_name, breeder_address, breeder_phone, breeder_email)
  values (p_name, p_kennel_name, p_affix, p_breeder_name, p_breeder_address, p_breeder_phone, p_breeder_email)
  returning id into v_space_id;
  insert into space_members (space_id, user_id, name, email)
  values (v_space_id, auth.uid(), p_member_name, (select email from auth.users where id = auth.uid()));
  insert into payers (space_id, label) values (v_space_id, 'Cash');
  insert into task_templates (space_id, name, phase, anchor, offset_days, sort_order, repeat) values
    (v_space_id, 'Progesterone test #1', 'prewhelp', 'heat', 10, 5, null),
    (v_space_id, 'Progesterone test #2 — confirm ovulation', 'prewhelp', 'heat', 13, 6, null),
    (v_space_id, '2nd mating (15th day)', 'prewhelp', 'ovulation', 2, 7, null),
    (v_space_id, 'Ultrasound — pregnancy check', 'prewhelp', 'ovulation', 35, 8, null),
    (v_space_id, 'Prepare whelping box', 'prewhelp', 'whelping', -14, 10, null),
    (v_space_id, 'Whelping box temperature check', 't1_birth', 'whelping', 0, 50, '{"every":1,"count":21}'),
    (v_space_id, 'Deworming #1', 't1_birth', 'whelping', 14, 80, null),
    (v_space_id, 'Microchipping — vet visit', 't2_wean', 'whelping', 42, 160, null),
    (v_space_id, 'Vaccine #1', 't3_social', 'whelping', 49, 180, null),
    (v_space_id, 'Handover day — contracts & passports', 't3_social', 'whelping', 63, 220, null);
  return v_space_id;
end; $$;
