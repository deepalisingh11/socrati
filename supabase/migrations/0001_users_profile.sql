-- ── 1. Users profile table ───────────────────────────────────────────────────
create table public.users (
    id          uuid        primary key references auth.users (id) on delete cascade,
    email       text        not null,
    name        text,
    created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: select own"
    on public.users for select
    using (auth.uid() = id);

create policy "users: update own"
    on public.users for update
    using (auth.uid() = id);

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
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
