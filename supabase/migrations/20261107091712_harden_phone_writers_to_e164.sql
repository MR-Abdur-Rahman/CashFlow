-- Harden the three functions that write a phone column so they can only ever store canonical
-- E.164 — anything else is DROPPED to NULL rather than raising.
--
-- Why "drop, don't fail": each of these sits on a critical path where a bad phone must not block
-- the real operation.
--   * handle_new_user() runs inside the auth.users INSERT transaction, so raising would make
--     SIGN-UP ITSELF FAIL — not merely skip the phone.
--   * create_mutual_connection() is SECURITY DEFINER and callable directly over RPC with arbitrary
--     text, so raising would break CONNECTING over a cosmetic field.
--   * sync_group_member_connections() copies profiles.phone_number into people; after the cleanup
--     migration the source is already clean, so this is belt-and-braces.
-- This matches the client's stance for scanned QR payloads (src/lib/connectQr.ts): keep the number
-- only if it normalises, otherwise carry on without it.
--
-- Required before the CHECK constraint lands: without this, any of the above receiving a legacy or
-- junk value would hard-fail instead of degrading gracefully.

-- Shared guard: the value when it is canonical E.164, else NULL. IMMUTABLE so it is usable
-- anywhere, including in a future index or constraint.
create or replace function public.safe_e164(p_phone text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_phone is not null and p_phone ~ '^\+[1-9][0-9]{6,14}$' then p_phone
    else null
  end;
$function$;

revoke execute on function public.safe_e164(text) from public, anon;
grant execute on function public.safe_e164(text) to authenticated;

-- 1) handle_new_user: phone arrives as untrusted signup metadata. Everything else (profile insert,
--    google_email derivation, default cash account, category seed) is unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, phone_number, google_email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    -- Signup metadata is user-controlled: store it only if it is already E.164.
    public.safe_e164(new.raw_user_meta_data->>'phone'),
    case when new.raw_app_meta_data->>'provider' = 'google'
         then coalesce(new.raw_user_meta_data->>'email', new.email)
         else null end
  )
  on conflict (id) do nothing;

  insert into public.accounts (user_id, type, label, opening_balance, current_balance, icon_type, icon_name, icon_color)
  values (new.id, 'cash', 'Cash', 0, 0, 'preset', 'cash', '#166534')
  on conflict do nothing;

  perform public.seed_default_categories(new.id);
  return new;
end;
$function$;

-- 2) create_mutual_connection: both phone params are untrusted RPC input. Authorisation checks,
--    self-connect guard, and the insert/update-both-directions behaviour are unchanged.
create or replace function public.create_mutual_connection(
  scanner_user_id uuid,
  scanner_name text,
  scanner_phone text,
  scanned_user_id uuid,
  scanned_name text,
  scanned_phone text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_scanner_phone text := public.safe_e164(scanner_phone);
  v_scanned_phone text := public.safe_e164(scanned_phone);
begin
  if auth.uid() is null or scanner_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if scanned_user_id = scanner_user_id then
    raise exception 'cannot connect to yourself';
  end if;

  -- Add scanned user to scanner's people list
  if not exists (
    select 1 from people where user_id = scanner_user_id and linked_user_id = scanned_user_id
  ) then
    insert into people (user_id, name, phone_number, linked_user_id)
    values (scanner_user_id, scanned_name, v_scanned_phone, scanned_user_id);
  else
    update people set name = scanned_name, phone_number = v_scanned_phone
    where user_id = scanner_user_id and linked_user_id = scanned_user_id;
  end if;

  -- Add scanner to scanned user's people list (mutual)
  if not exists (
    select 1 from people where user_id = scanned_user_id and linked_user_id = scanner_user_id
  ) then
    insert into people (user_id, name, phone_number, linked_user_id)
    values (scanned_user_id, scanner_name, v_scanner_phone, scanner_user_id);
  else
    update people set name = scanner_name, phone_number = v_scanner_phone
    where user_id = scanned_user_id and linked_user_id = scanner_user_id;
  end if;
end;
$function$;

-- 3) sync_group_member_connections: copies profiles.phone_number into people. Pairwise member
--    iteration and the not-exists guard are unchanged.
create or replace function public.sync_group_member_connections(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE u1 uuid; u2 uuid;
BEGIN
  FOR u1 IN
    SELECT uid FROM (
      SELECT created_by AS uid FROM groups WHERE id = p_group_id
      UNION
      SELECT member_user_id FROM group_members WHERE group_id = p_group_id AND member_user_id IS NOT NULL
    ) m WHERE uid IS NOT NULL
  LOOP
    FOR u2 IN
      SELECT uid FROM (
        SELECT created_by AS uid FROM groups WHERE id = p_group_id
        UNION
        SELECT member_user_id FROM group_members WHERE group_id = p_group_id AND member_user_id IS NOT NULL
      ) m WHERE uid IS NOT NULL AND uid <> u1
    LOOP
      IF NOT EXISTS (SELECT 1 FROM people WHERE user_id = u1 AND linked_user_id = u2) THEN
        INSERT INTO people (user_id, name, phone_number, linked_user_id)
        SELECT u1, COALESCE(pr.full_name, 'Friend'), public.safe_e164(pr.phone_number), u2
        FROM profiles pr WHERE pr.id = u2;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;
