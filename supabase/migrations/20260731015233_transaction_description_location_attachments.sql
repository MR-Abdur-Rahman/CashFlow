-- Rich detail on a transaction: long-form description, an optional pinned location, and file
-- attachments. The existing `note` column is unchanged and keeps its role as the short one-liner
-- rendered in list rows; `description` is the long-form body for the detail view.

-- 1) New columns. All nullable, so every existing row and every current insert path
--    (AddTransactionSheet, ScheduledTransactionSheet via lib/scheduled.ts, SplitForm) stays valid
--    with no code change. Lat/lng are plain numeric — no PostGIS dependency, and we only ever need
--    to store and re-display a single point, not query by proximity.
alter table public.transactions add column if not exists description text;
alter table public.transactions add column if not exists location_lat numeric;
alter table public.transactions add column if not exists location_lng numeric;

comment on column public.transactions.description is
  'Long-form detail for the transaction, shown in the detail view. Distinct from `note`, which stays the short label shown in list rows.';
comment on column public.transactions.location_lat is
  'Latitude of the place the transaction happened. Null unless the user pinned a location; always set together with location_lng.';
comment on column public.transactions.location_lng is
  'Longitude of the place the transaction happened. Null unless the user pinned a location; always set together with location_lat.';

-- 2) Attachments child table. A child table (rather than an array column on transactions, as feedback
--    uses) because each attachment carries its own metadata and is added/removed individually, and
--    there is no webhook-atomicity constraint here.
create table if not exists public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  type text not null check (type in ('image', 'document')),
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

comment on table public.transaction_attachments is
  'Files attached to a transaction. Rows cascade-delete with their transaction; the underlying storage objects in the transaction-attachments bucket do not and must be removed by the client (or the delete-account Edge Function).';
comment on column public.transaction_attachments.file_path is
  'Object path within the private transaction-attachments bucket, shaped `${user_id}/${transaction_id}/${filename}`. A path, not a URL — the bucket is private, so viewers need a fresh signed URL each time.';

-- Every read is "attachments for this transaction", so index the FK.
create index if not exists transaction_attachments_transaction_id_idx
  on public.transaction_attachments (transaction_id);

-- 3) RLS. transaction_attachments has no user_id of its own; ownership is derived by joining to the
--    parent transaction, which mirrors the single `auth.uid() = user_id` rule already on transactions.
--    Split into four policies (rather than one FOR ALL) so INSERT gets an explicit WITH CHECK that
--    stops a user attaching a file to someone else's transaction.
alter table public.transaction_attachments enable row level security;

grant select, insert, update, delete on public.transaction_attachments to authenticated;

drop policy if exists "Attachments: read own" on public.transaction_attachments;
create policy "Attachments: read own"
  on public.transaction_attachments for select to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_attachments.transaction_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Attachments: insert own" on public.transaction_attachments;
create policy "Attachments: insert own"
  on public.transaction_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_attachments.transaction_id
        and t.user_id = auth.uid()
    )
  );

-- USING gates which rows can be updated; WITH CHECK stops the update from re-pointing the row at
-- another user's transaction.
drop policy if exists "Attachments: update own" on public.transaction_attachments;
create policy "Attachments: update own"
  on public.transaction_attachments for update to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_attachments.transaction_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_attachments.transaction_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Attachments: delete own" on public.transaction_attachments;
create policy "Attachments: delete own"
  on public.transaction_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_attachments.transaction_id
        and t.user_id = auth.uid()
    )
  );
