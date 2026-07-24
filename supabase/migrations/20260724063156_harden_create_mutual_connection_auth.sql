-- SECURITY FIX: create_mutual_connection trusted a caller-supplied scanner_user_id, letting any
-- authenticated client forge a connection between arbitrary users. Require the scanner to be the
-- authenticated caller. Existing QR linking is unaffected (the real caller IS the scanner).
create or replace function public.create_mutual_connection(
  scanner_user_id uuid,
  scanner_name text,
  scanner_phone text,
  scanned_user_id uuid,
  scanned_name text,
  scanned_phone text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    values (scanner_user_id, scanned_name, scanned_phone, scanned_user_id);
  else
    update people set name = scanned_name, phone_number = scanned_phone
    where user_id = scanner_user_id and linked_user_id = scanned_user_id;
  end if;

  -- Add scanner to scanned user's people list (mutual)
  if not exists (
    select 1 from people where user_id = scanned_user_id and linked_user_id = scanner_user_id
  ) then
    insert into people (user_id, name, phone_number, linked_user_id)
    values (scanned_user_id, scanner_name, scanner_phone, scanner_user_id);
  else
    update people set name = scanner_name, phone_number = scanner_phone
    where user_id = scanned_user_id and linked_user_id = scanner_user_id;
  end if;
end;
$function$;
