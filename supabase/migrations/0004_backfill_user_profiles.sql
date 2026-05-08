insert into public.users (user_id, email, name, created_at)
select
    au.id,
    coalesce(au.email, ''),
    au.raw_user_meta_data ->> 'name',
    au.created_at
from auth.users au
where not exists (
    select 1
    from public.users pu
    where pu.user_id = au.id
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (user_id, email, name)
    values (
        new.id,
        coalesce(new.email, ''),
        new.raw_user_meta_data ->> 'name'
    )
    on conflict (user_id) do update
    set
        email = excluded.email,
        name = excluded.name;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

notify pgrst, 'reload schema';
