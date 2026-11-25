-- Fix: suspend baru aktif setelah 5x password salah.
-- Level eskalasi tiap 5 kegagalan: ke-5 -> 10d, ke-10 -> 20d, ke-15 -> 40d ... maks 24 jam.
-- Kegagalan 1-4 hanya dihitung, tidak menyuspend.
create or replace function public.login_lock_fail(p_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.login_attempts%rowtype;
  n int;
  level int;
  dur int;
begin
  insert into public.login_attempts (key) values (p_key)
    on conflict (key) do nothing;

  select * into r from public.login_attempts where key = p_key for update;

  -- suspend masih aktif -> jangan tambah counter
  if r.locked_until is not null and r.locked_until > now() then
    return json_build_object(
      'locked', true,
      'seconds', ceil(extract(epoch from (r.locked_until - now())))::int,
      'count', r.failed_count,
      'remaining', 0
    );
  end if;

  n := r.failed_count + 1;

  -- tiap 5 kegagalan -> suspend dengan durasi eskalasi
  if n % 5 = 0 then
    level := n / 5;
    dur := least(10 * power(2, level - 1)::int, 86400);
    update public.login_attempts
       set failed_count = n,
           locked_until = now() + (dur || ' seconds')::interval,
           updated_at = now()
     where key = p_key;
    return json_build_object('locked', true, 'seconds', dur, 'count', n, 'remaining', 0);
  end if;

  -- belum sampai 5x -> hanya catat, beri tahu sisa percobaan
  update public.login_attempts
     set failed_count = n, updated_at = now()
   where key = p_key;
  return json_build_object('locked', false, 'seconds', 0, 'count', n, 'remaining', 5 - (n % 5));
end;
$$;
