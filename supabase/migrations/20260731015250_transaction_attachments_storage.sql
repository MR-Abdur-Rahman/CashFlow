-- Storage bucket for transaction attachments.
--
-- NOTE: this is the first storage migration in the repo. The existing `avatars` and `feedback`
-- buckets were created out-of-band via the dashboard and still live only in the remote project;
-- they are deliberately left alone here.
--
-- Unlike `avatars`, this bucket is PRIVATE. Avatars are public because they must render for every
-- viewer of a shared split; transaction attachments are single-user financial records that only
-- their owner ever sees, so reads go through short-lived signed URLs (createSignedUrl) rather than
-- getPublicUrl. That is also why transaction_attachments.file_path stores a path, not a URL.

-- 1) The bucket. 10 MB ceiling, images plus PDF. on conflict makes the migration re-runnable and
--    lets it correct the limits if the bucket was already created by hand.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-attachments',
  'transaction-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) RLS on storage.objects, structurally identical to the avatars policies: first path segment must
--    be the caller's uid. Object keys are `${userId}/${transactionId}/${filename}` — the extra nested
--    segment (the EntityAvatarUpload `${uid}/people/${id}-…` pattern) still satisfies
--    foldername(name)[1], so the same check covers it.
--
--    The bucket being private means the SELECT policy is what actually gates reads here, unlike
--    avatars where the public CDN path bypasses RLS entirely.

drop policy if exists "Transaction attachments: read own" on storage.objects;
create policy "Transaction attachments: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Transaction attachments: upload own" on storage.objects;
create policy "Transaction attachments: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- The avatars UPDATE policies have a null WITH CHECK, which leaves a rename into another user's
-- folder unblocked by that policy. Both clauses are set here so the destination key is checked too.
drop policy if exists "Transaction attachments: update own" on storage.objects;
create policy "Transaction attachments: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Transaction attachments: delete own" on storage.objects;
create policy "Transaction attachments: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
