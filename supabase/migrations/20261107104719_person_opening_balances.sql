-- Opening balance: a debt that predates CashFlow, recorded against a LOCAL contact.
--
-- Deliberately a SEPARATE table rather than columns on `people`. The `people` table carries a
-- second SELECT policy, "Read people who co-participate in your splits" (can_see_person_via_split),
-- which exposes the WHOLE row to any user who shares a split with that contact. An opening balance
-- is a private, one-sided bookkeeping note, so putting it on `people` would leak it to co-
-- participants. Column-level REVOKE is not a workaround — column privileges are checked
-- independently of RLS, so revoking would break the owner's own reads too.
--
-- A person with no row here simply has no opening balance; there is no zero row to maintain.
-- `amount` is unsigned and the side is carried by `direction`, which keeps the pairing
-- unambiguous (no "negative means they owe me" convention to misread).
--
-- Never written by any trigger or SECURITY DEFINER function: it is set only by the owner through
-- AddPersonDialog. Account balances, settlement triggers and notifications are untouched — the
-- opening balance is applied purely in the bilateral-net calculation (src/lib/balance.ts).

create table public.person_opening_balances (
  person_id uuid primary key references public.people(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  direction text not null check (direction in ('they_owe_me','i_owe_them')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.person_opening_balances enable row level security;

-- Single policy for ALL commands: you only ever see or write your own rows, and the person the row
-- points at must also be yours (so a row can't be attached to someone else's contact).
create policy person_opening_balances_owner on public.person_opening_balances
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and person_id in (select id from public.people where user_id = auth.uid())
  );

comment on table public.person_opening_balances is
  'Pre-CashFlow debt for a local contact. One-sided and private to the owner (hence a separate table, not columns on people). Applied only in the bilateral-net calculation; never affects account balances.';
