-- Move the notify-feedback webhook shared secret out of the function body and into Supabase Vault.
-- The previous literal was hardcoded in both this trigger and the Edge Function source and is being
-- rotated out; the Edge Function reads the matching value from the FEEDBACK_WEBHOOK_SECRET project
-- secret. Vault entry name: feedback_webhook_secret.
create or replace function public.notify_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'feedback_webhook_secret';

  -- Never abort the insert over a notification problem: the user's feedback must still persist even
  -- if the secret is missing and the email can't be dispatched.
  if v_secret is null then
    raise warning 'notify_feedback_insert: vault secret feedback_webhook_secret is missing; skipping webhook';
    return new;
  end if;

  perform net.http_post(
    url := 'https://chvsufaeljepxhtowzdm.supabase.co/functions/v1/notify-feedback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$function$;
