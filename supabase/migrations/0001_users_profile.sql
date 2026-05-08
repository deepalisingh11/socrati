-- ── 1. Users profile table ───────────────────────────────────────────────────
create table if not exists public.users (
    id          uuid        primary key references auth.users (id) on delete cascade,
    email       text        not null,
    name        text,
    created_at  timestamptz not null default now()
);

alter table public.users
    add column if not exists email text,
    add column if not exists name text,
    add column if not exists created_at timestamptz not null default now();

alter table public.users enable row level security;

drop policy if exists "users: select own" on public.users;
drop policy if exists "users: update own" on public.users;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'id'
    ) then
        create policy "users: select own"
            on public.users for select
            using (auth.uid() = id);

        create policy "users: update own"
            on public.users for update
            using (auth.uid() = id);
    end if;
end $$;

-- ── 2. Auto-create profile row on auth.users insert ─────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, email, name)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'name'
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
