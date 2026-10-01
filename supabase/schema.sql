-- ============================================================
-- SICAIR — Sistem Pengajuan NPD & Monitoring Pencairan Dana
-- Skema Supabase (PostgreSQL 15+)
-- Cara pakai: Supabase Dashboard > SQL Editor > paste file ini > Run
-- Urutan: schema.sql dulu, lalu seed.sql
-- ============================================================

-- ---------- 0. EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- 1. MASTER: BIDANG ----------
create table if not exists public.bidang (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,            -- Sekretariat, Keolahragaan, Kepemudaan, Kepramukaan
  kode text not null unique,            -- SEK, OLAHRAGA, MUDA, PRAMUKA
  created_at timestamptz not null default now()
);

-- ---------- 1b. MASTER: PTK (Pejabat Pelaksana Teknis Kegiatan) ----------
-- Dipakai untuk mencetak NPD: nama + NIP penanda tangan, dikelola admin per bidang.
create table if not exists public.ptk (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.bidang(id) on delete cascade,
  nama text not null,                          -- nama + gelar, mis. "DENNI JAMRUDINAVIA, S.IP., MM"
  nip text not null default '',                -- format dokumen, mis. "19810604 201001 2 001"
  jabatan text not null default 'Pejabat Pelaksana Teknis Kegiatan',
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ptk_bidang_nama unique (bidang_id, nama)
);
create index if not exists idx_ptk_bidang on public.ptk(bidang_id);

-- ---------- 2. PROFILE (role + bidang per akun) ----------
-- id = auth.users.id
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('admin','user')),
  bidang_id uuid references public.bidang(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_bidang on public.profiles(bidang_id);
create index if not exists idx_profiles_role on public.profiles(role);

-- Auto-create profile saat user sign up (role default user, bidang null -> admin wajib isi)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: ambil role & bidang milik requester (SECURITY DEFINER agar lolos RLS)
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon')
$$;

create or replace function public.my_bidang_id()
returns uuid language sql stable security definer set search_path = public as $$
  select bidang_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------- 3. PAGU / BUDGET LINES ----------
-- Satu baris = kombinasi bidang + sub kegiatan + uraian + tahun (unik)
create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.bidang(id) on delete restrict,
  tahun int not null default 2026 check (tahun between 2020 and 2100),
  kode_program text not null default '',
  nama_program text not null default '',
  kode_kegiatan text not null default '',
  nama_kegiatan text not null default '',
  kode_sub_kegiatan text not null,
  nama_sub_kegiatan text not null,
  kode_uraian text not null,
  nama_uraian text not null,
  pagu numeric(18,2) not null default 0 check (pagu >= 0),
  angkas_s1 numeric(18,2) not null default 0 check (angkas_s1 >= 0),  -- kuota Semester 1 (Jan–Jun); 0 = belum diatur
  angkas_s2 numeric(18,2) not null default 0 check (angkas_s2 >= 0),  -- kuota Semester 2 (Jul–Des); 0 = belum diatur
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_budget unique (bidang_id, kode_sub_kegiatan, kode_uraian, tahun)
);
create index if not exists idx_budget_bidang on public.budget_lines(bidang_id);
create index if not exists idx_budget_tahun on public.budget_lines(tahun);
create index if not exists idx_budget_sub on public.budget_lines(kode_sub_kegiatan);
create index if not exists idx_budget_search on public.budget_lines
  using gin (to_tsvector('simple', kode_sub_kegiatan || ' ' || nama_sub_kegiatan || ' ' || kode_uraian || ' ' || nama_uraian));

-- ---------- 4. PENGAJUAN NPD (header) ----------
create table if not exists public.npd_status (
  kode text primary key,
  label text not null,
  urutan int not null
);
insert into public.npd_status (kode, label, urutan) values
  ('DRAFT','Draft',10),
  ('DIAJUKAN','Diajukan',20),
  ('DIPROSES','Diproses',30),
  ('REVISI','Revisi',40),
  ('SIAP_DICAIRKAN','Siap Dicairkan',50),
  ('CAIR','Cair',60),
  ('SELESAI','Selesai',70),
  ('DITOLAK','Ditolak',80)
on conflict (kode) do nothing;

create table if not exists public.pengajuan (
  id uuid primary key default gen_random_uuid(),
  nomor_pengajuan text not null unique,       -- dibuat via trigger: NPD/2026/ROM/0001
  bidang_id uuid not null references public.bidang(id) on delete restrict,
  tahun int not null default 2026,
  tanggal_pengajuan date not null default current_date,
  nama_npd text not null,                     -- nama/nomor NPD sesuai dokumen
  ptk_id uuid references public.ptk(id) on delete set null,  -- PPTK penanda tangan NPD
  catatan text,
  status text not null default 'DRAFT' references public.npd_status(kode),
  diajukan_oleh uuid references public.profiles(id),
  total_nominal numeric(18,2) not null default 0 check (total_nominal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pengajuan_bidang on public.pengajuan(bidang_id);
create index if not exists idx_pengajuan_status on public.pengajuan(status);
create index if not exists idx_pengajuan_tahun on public.pengajuan(tahun);

-- Nomor otomatis: NPD/{tahun}/{KODE_BIDANG}/{seq 4 digit per bidang+tahun}
create or replace function public.generate_nomor_pengajuan()
returns trigger language plpgsql as $$
declare v_kode text; v_seq int;
begin
  select kode into v_kode from public.bidang where id = new.bidang_id;
  select count(*) + 1 into v_seq
    from public.pengajuan
    where bidang_id = new.bidang_id and tahun = new.tahun;
  new.nomor_pengajuan := format('NPD/%s/%s/%s', new.tahun, coalesce(v_kode,'XX'), lpad(v_seq::text, 4, '0'));
  return new;
end $$;

drop trigger if exists trg_nomor_pengajuan on public.pengajuan;
create trigger trg_nomor_pengajuan
  before insert on public.pengajuan
  for each row when (new.nomor_pengajuan is null or new.nomor_pengajuan = '')
  execute function public.generate_nomor_pengajuan();

-- ---------- 5. ITEM PENGAJUAN (detail) ----------
create table if not exists public.pengajuan_items (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines(id) on delete restrict,
  nominal numeric(18,2) not null check (nominal > 0),
  created_at timestamptz not null default now(),
  -- PRD: satu budget line tidak boleh duplikat dalam satu pengajuan
  constraint uq_item_per_pengajuan unique (pengajuan_id, budget_line_id)
);
create index if not exists idx_items_pengajuan on public.pengajuan_items(pengajuan_id);
create index if not exists idx_items_budget on public.pengajuan_items(budget_line_id);

-- Total header selalu = sum items (trigger)
create or replace function public.refresh_pengajuan_total()
returns trigger language plpgsql as $$
begin
  update public.pengajuan p
     set total_nominal = coalesce((select sum(nominal) from public.pengajuan_items where pengajuan_id = p.id), 0),
         updated_at = now()
   where p.id = coalesce(new.pengajuan_id, old.pengajuan_id);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_items_total_ins on public.pengajuan_items;
create trigger trg_items_total_ins after insert or update or delete on public.pengajuan_items
  for each row execute function public.refresh_pengajuan_total();

-- Validasi: item hanya boleh ditambah saat DRAFT/REVISI, bidang item harus sama dgn header,
-- nominal tidak boleh melebihi sisa pagu uraian (cair + diproses).
create or replace function public.validate_pengajuan_item()
returns trigger language plpgsql as $$
declare
  v_status text; v_bidang uuid; v_item_bidang uuid;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_new_sub text; v_other int;
begin
  select status, bidang_id into v_status, v_bidang
    from public.pengajuan where id = new.pengajuan_id;

  if v_status not in ('DRAFT','REVISI') then
    raise exception 'Item hanya bisa diubah saat DRAFT/REVISI (status saat ini: %)', v_status;
  end if;

  select bidang_id, pagu into v_item_bidang, v_pagu
    from public.budget_lines where id = new.budget_line_id;

  if v_item_bidang is distinct from v_bidang then
    raise exception 'Uraian bukan milik bidang pengajuan';
  end if;

  -- Sudah cair (realisasi)
  select coalesce(sum(d.nominal),0) into v_cair
    from public.disbursements d
    join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
    where pi.budget_line_id = new.budget_line_id;

  -- Sedang diproses (DIAJUKAN / DIPROSES / SIAP_DICAIRKAN) dari pengajuan lain
  select coalesce(sum(pi.nominal),0) into v_diproses
    from public.pengajuan_items pi
    join public.pengajuan p on p.id = pi.pengajuan_id
    where pi.budget_line_id = new.budget_line_id
      and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN');

  v_sisa := v_pagu - v_cair - v_diproses;
  if new.nominal > v_sisa then
    raise exception 'Nominal % melebihi sisa pagu % (sisa: pagu % minus cair % minus dalam proses %)',
      new.nominal, v_sisa, v_pagu, v_cair, v_diproses;
  end if;

  -- Aturan: 1 NPD hanya boleh 1 sub kegiatan (boleh banyak uraian dari sub itu).
  select kode_sub_kegiatan into v_new_sub from public.budget_lines where id = new.budget_line_id;
  select count(*) into v_other
    from public.pengajuan_items pi
    join public.budget_lines bl on bl.id = pi.budget_line_id
   where pi.pengajuan_id = new.pengajuan_id
     and pi.budget_line_id is distinct from new.budget_line_id
     and bl.kode_sub_kegiatan is distinct from v_new_sub;
  if v_other > 0 then
    raise exception '1 NPD hanya boleh 1 sub kegiatan. Buat NPD terpisah untuk sub yang berbeda.';
  end if;

  return new;
end $$;

drop trigger if exists trg_validate_item on public.pengajuan_items;
create trigger trg_validate_item
  before insert or update on public.pengajuan_items
  for each row execute function public.validate_pengajuan_item();

-- ---------- 6. DISBURSEMENTS (sumber realisasi, idempotent) ----------
create table if not exists public.disbursements (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete restrict,
  pengajuan_item_id uuid not null unique references public.pengajuan_items(id) on delete restrict,
  nominal numeric(18,2) not null check (nominal > 0),
  idempotency_key text not null unique,      -- proteksi double-cair
  dicairkan_oleh uuid references public.profiles(id),
  dicairkan_at timestamptz not null default now()
);
create index if not exists idx_disb_pengajuan on public.disbursements(pengajuan_id);

-- ---------- 7. REVISI REMARKS (append-only) ----------
create table if not exists public.revisi_remarks (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  remark text not null,
  diberikan_oleh uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_revisi_pengajuan on public.revisi_remarks(pengajuan_id);

-- ---------- 8. STATUS TIMELINE (append-only) ----------
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  from_status text,
  to_status text not null,
  catatan text,
  diubah_oleh uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_history_pengajuan on public.status_history(pengajuan_id);

-- Aturan transisi status (PRD section 9)
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from = 'DRAFT' and p_to in ('DIAJUKAN','DITOLAK') then true
    when p_from = 'DIAJUKAN' and p_to in ('DIPROSES','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'DIPROSES' and p_to in ('REVISI','SIAP_DICAIRKAN','DITOLAK','DRAFT') then true
    when p_from = 'REVISI' and p_to in ('DRAFT','DIPROSES','DITOLAK') then true
    when p_from = 'SIAP_DICAIRKAN' and p_to in ('CAIR','SELESAI','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'CAIR' and p_to in ('SELESAI') then true
    else false
  end
$$;

create or replace function public.enforce_status_flow()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    if not public.is_valid_transition(old.status, new.status) then
      raise exception 'Transisi % -> % tidak diizinkan', old.status, new.status;
    end if;
    insert into public.status_history (pengajuan_id, from_status, to_status, diubah_oleh)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_status_flow on public.pengajuan;
create trigger trg_status_flow
  before update of status on public.pengajuan
  for each row execute function public.enforce_status_flow();

-- ---------- 9. AUDIT LOG ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id),
  action text not null,                       -- create_pengajuan, submit, revisi, resubmit, ubah_status, pencairan, ubah_pagu ...
  entity text not null,                       -- pengajuan, budget_lines, disbursements ...
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id);
create index if not exists idx_audit_actor on public.audit_logs(actor);

-- ---------- 10. VIEWS: realisasi & sisa (CAIR + DIPROSES, bukan angka edit) ----------
drop view if exists public.v_dashboard_bidang;
drop view if exists public.v_budget_realisasi;

create view public.v_budget_realisasi as
with disbursed as (
  select pi.budget_line_id, coalesce(sum(d.nominal), 0) as total
  from public.pengajuan_items pi
  join public.disbursements d on d.pengajuan_item_id = pi.id
  group by pi.budget_line_id
),
in_process as (
  select pi.budget_line_id, coalesce(sum(pi.nominal), 0) as total
  from public.pengajuan_items pi
  join public.pengajuan p on p.id = pi.pengajuan_id
  where p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
  group by pi.budget_line_id
)
select
  bl.id as budget_line_id,
  bl.bidang_id,
  bl.tahun,
  bl.kode_program,
  bl.nama_program,
  bl.kode_kegiatan,
  bl.nama_kegiatan,
  bl.kode_sub_kegiatan,
  bl.nama_sub_kegiatan,
  bl.kode_uraian,
  bl.nama_uraian,
  bl.pagu,
  coalesce(d.total, 0)::numeric(18,2) as realisasi,
  coalesce(ip.total, 0)::numeric(18,2) as diproses,
  (bl.pagu - coalesce(d.total, 0) - coalesce(ip.total, 0))::numeric(18,2) as sisa,
  case when bl.pagu = 0 then 0
       else round(coalesce(d.total, 0) / bl.pagu * 100, 2) end as persen_realisasi
from public.budget_lines bl
left join disbursed d on d.budget_line_id = bl.id
left join in_process ip on ip.budget_line_id = bl.id;

create view public.v_dashboard_bidang as
select
  b.id as bidang_id,
  b.nama as bidang,
  extract(year from now())::int as tahun_ref,
  coalesce(sum(bl.pagu),0)::numeric(18,2) as total_pagu,
  coalesce(sum(v.realisasi),0)::numeric(18,2) as total_realisasi,
  coalesce(sum(v.diproses),0)::numeric(18,2) as total_diproses,
  coalesce(sum(v.sisa),0)::numeric(18,2) as total_sisa,
  case when coalesce(sum(bl.pagu),0) = 0 then 0
       else round(coalesce(sum(v.realisasi),0) / sum(bl.pagu) * 100, 2) end as persen
from public.bidang b
left join public.budget_lines bl on bl.bidang_id = b.id
left join public.v_budget_realisasi v on v.budget_line_id = bl.id
group by b.id, b.nama;

-- View harus tunduk pada RLS penanya (bukan owner), agar user tidak bisa
-- mengintip bidang lain lewat view. Butuh PostgreSQL 15+.
alter view public.v_budget_realisasi set (security_invoker = true);
alter view public.v_dashboard_bidang set (security_invoker = true);

-- ---------- 11. RPC: PENCAIRAN TRANSAKSIONAL (hanya admin, idempotent) ----------
create or replace function public.cairkan_pengajuan(p_pengajuan_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text; v_total numeric; r record; v_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mencairkan';
  end if;

  select status, total_nominal into v_status, v_total
    from public.pengajuan where id = p_pengajuan_id for update;

  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
  if v_status <> 'SIAP_DICAIRKAN' then
    raise exception 'Hanya status SIAP_DICAIRKAN yang bisa dicairkan (saat ini: %)', v_status;
  end if;

  -- idempotency: jika key sudah dipakai untuk pengajuan ini, kembalikan hasil lama
  if exists (select 1 from public.disbursements where pengajuan_id = p_pengajuan_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_total);
  end if;

  for r in select id, nominal from public.pengajuan_items where pengajuan_id = p_pengajuan_id loop
    insert into public.disbursements (pengajuan_id, pengajuan_item_id, nominal, idempotency_key, dicairkan_oleh)
    values (p_pengajuan_id, r.id, r.nominal, p_idempotency_key || ':' || r.id::text, auth.uid())
    on conflict (pengajuan_item_id) do nothing;
    get diagnostics v_count = row_count;
  end loop;

  update public.pengajuan set status = 'SELESAI' where id = p_pengajuan_id;

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'pencairan', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object('total', v_total, 'idempotency_key', p_idempotency_key));

  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total);
end $$;

-- RPC: ubah status + catat audit + (opsional) remark revisi, dengan cek role
-- + CEGAH MINUS: pengajuan ke DIAJUKAN ditolak bila nominal item melebihi sisa pagu
create or replace function public.ubah_status_pengajuan(p_pengajuan_id uuid, p_to text, p_catatan text default null, p_remark text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_admin bool;
  v_item record;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
begin
  v_admin := public.is_admin();
  select status into v_from from public.pengajuan where id = p_pengajuan_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;

  -- user tidak boleh memproses pencairan / siap_cair / memaksa ke CAIR
  if not v_admin and p_to in ('DIPROSES','SIAP_DICAIRKAN','CAIR','SELESAI') then
    raise exception 'Hanya admin yang dapat mengubah ke %', p_to;
  end if;
  -- hanya admin yang boleh memberi revisi/ditolak dari jalur proses
  if not v_admin and p_to in ('REVISI','DITOLAK') then
    raise exception 'Hanya admin yang dapat memberi revisi/penolakan';
  end if;
  -- hanya admin yang boleh mengembalikan ke DRAFT; user tinggal ubah + ajukan ulang
  if not v_admin and p_to = 'DRAFT' then
    raise exception 'Hanya admin yang dapat mengembalikan ke DRAFT';
  end if;

  -- CEGAH MINUS: saat diajukan, nominal tiap item tidak boleh melebihi
  -- sisa pagu uraian saat ini (pagu - sudah cair - sedang diproses NPD lain).
  if p_to = 'DIAJUKAN' and v_from in ('DRAFT', 'REVISI') then
    for v_item in
      select pi.nominal, pi.budget_line_id, bl.kode_uraian, bl.nama_uraian
        from public.pengajuan_items pi
        join public.budget_lines bl on bl.id = pi.budget_line_id
       where pi.pengajuan_id = p_pengajuan_id
    loop
      select bl2.pagu into v_pagu
        from public.budget_lines bl2 where bl2.id = v_item.budget_line_id;

      select coalesce(sum(d.nominal), 0) into v_cair
        from public.disbursements d
        join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
       where pi2.budget_line_id = v_item.budget_line_id;

      select coalesce(sum(pi3.nominal), 0) into v_diproses
        from public.pengajuan_items pi3
        join public.pengajuan p3 on p3.id = pi3.pengajuan_id
       where pi3.budget_line_id = v_item.budget_line_id
         and pi3.pengajuan_id <> p_pengajuan_id
         and p3.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN');

      v_sisa := coalesce(v_pagu, 0) - v_cair - v_diproses;
      if v_item.nominal > v_sisa then
        raise exception 'Uraian % (%) nominal % melebihi sisa pagu % (pagu % - cair % - diproses %). Pengajuan ditolak agar sisa tidak minus.',
          v_item.kode_uraian, v_item.nama_uraian, v_item.nominal,
          v_sisa, v_pagu, v_cair, v_diproses;
      end if;
    end loop;
  end if;

  update public.pengajuan set status = p_to where id = p_pengajuan_id;

  if p_to = 'REVISI' and p_remark is not null then
    insert into public.revisi_remarks (pengajuan_id, remark, diberikan_oleh)
    values (p_pengajuan_id, p_remark, auth.uid());
  end if;

  insert into public.status_history (pengajuan_id, from_status, to_status, catatan, diubah_oleh)
  values (p_pengajuan_id, v_from, p_to, p_catatan, auth.uid());

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'ubah_status', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object('from', v_from, 'to', p_to, 'catatan', p_catatan));

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to);
end $$;

-- ---------- 12. RLS ----------
alter table public.bidang enable row level security;
alter table public.ptk enable row level security;
alter table public.profiles enable row level security;
alter table public.budget_lines enable row level security;
alter table public.pengajuan enable row level security;
alter table public.pengajuan_items enable row level security;
alter table public.disbursements enable row level security;
alter table public.revisi_remarks enable row level security;
alter table public.status_history enable row level security;
alter table public.audit_logs enable row level security;

-- bidang: semua user login bisa baca (dropdown difilter di server)
drop policy if exists "bidang_read_all" on public.bidang;
create policy "bidang_read_all" on public.bidang for select to authenticated using (true);
drop policy if exists "bidang_admin_write" on public.bidang;
create policy "bidang_admin_write" on public.bidang for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ptk: user baca PTK bidangnya (untuk dropdown NPD), tulis hanya admin
drop policy if exists "ptk_select" on public.ptk;
create policy "ptk_select" on public.ptk for select to authenticated
  using (public.is_admin() or bidang_id = public.my_bidang_id());
drop policy if exists "ptk_admin_write" on public.ptk;
create policy "ptk_admin_write" on public.ptk for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: baca diri sendiri + admin baca semua; update diri (non-role) + admin semua
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated with check (id = auth.uid());

-- budget_lines: select sesuai bidang; write admin saja
drop policy if exists "budget_select" on public.budget_lines;
create policy "budget_select" on public.budget_lines for select to authenticated
  using (public.is_admin() or bidang_id = public.my_bidang_id());
drop policy if exists "budget_admin_write" on public.budget_lines;
create policy "budget_admin_write" on public.budget_lines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pengajuan: select sesuai bidang; insert: bidang harus = bidang sendiri (kecuali admin)
drop policy if exists "pengajuan_select" on public.pengajuan;
create policy "pengajuan_select" on public.pengajuan for select to authenticated
  using (public.is_admin() or bidang_id = public.my_bidang_id());
drop policy if exists "pengajuan_insert" on public.pengajuan;
create policy "pengajuan_insert" on public.pengajuan for insert to authenticated
  with check (public.is_admin() or bidang_id = public.my_bidang_id());
drop policy if exists "pengajuan_update" on public.pengajuan;
create policy "pengajuan_update" on public.pengajuan for update to authenticated
  using (public.is_admin() or (bidang_id = public.my_bidang_id() and status in ('DRAFT','REVISI','DIAJUKAN')));
drop policy if exists "pengajuan_delete" on public.pengajuan;
create policy "pengajuan_delete" on public.pengajuan for delete to authenticated
  using (public.is_admin() or (bidang_id = public.my_bidang_id() and status = 'DRAFT'));

-- items: ikut bidang parent pengajuan
drop policy if exists "items_select" on public.pengajuan_items;
create policy "items_select" on public.pengajuan_items for select to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
drop policy if exists "items_insert" on public.pengajuan_items;
create policy "items_insert" on public.pengajuan_items for insert to authenticated
  with check (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
drop policy if exists "items_update" on public.pengajuan_items;
create policy "items_update" on public.pengajuan_items for update to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
drop policy if exists "items_delete" on public.pengajuan_items;
create policy "items_delete" on public.pengajuan_items for delete to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or (p.bidang_id = public.my_bidang_id() and p.status in ('DRAFT','REVISI')))));

-- disbursements: user bisa baca milik bidangnya; write hanya via RPC (admin)
drop policy if exists "disb_select" on public.disbursements;
create policy "disb_select" on public.disbursements for select to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
-- tidak ada policy insert/update/delete langsung -> hanya service_role / RPC definer

-- revisi & history & audit: baca sesuai bidang; tulis admin (remark) / sistem
drop policy if exists "revisi_select" on public.revisi_remarks;
create policy "revisi_select" on public.revisi_remarks for select to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
drop policy if exists "revisi_insert_admin" on public.revisi_remarks;
create policy "revisi_insert_admin" on public.revisi_remarks for insert to authenticated
  with check (public.is_admin());

drop policy if exists "history_select" on public.status_history;
create policy "history_select" on public.status_history for select to authenticated
  using (exists (select 1 from public.pengajuan p where p.id = pengajuan_id
                 and (public.is_admin() or p.bidang_id = public.my_bidang_id())));
drop policy if exists "history_insert" on public.status_history;
create policy "history_insert" on public.status_history for insert to authenticated with check (true);

drop policy if exists "audit_select_admin" on public.audit_logs;
create policy "audit_select_admin" on public.audit_logs for select to authenticated
  using (public.is_admin());
-- insert audit diizinkan dari RPC / client terautentikasi (actor = diri sendiri)
drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs for insert to authenticated
  with check (actor = auth.uid() or public.is_admin());

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_budget on public.budget_lines;
create trigger trg_touch_budget before update on public.budget_lines
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_ptk on public.ptk;
create trigger trg_touch_ptk before update on public.ptk
  for each row execute function public.touch_updated_at();
