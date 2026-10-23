-- PIN visible para CEO / members.manage (ademas del hash de login).
-- Los obreros ya existentes quedan sin pin_display hasta un "Nuevo PIN".
begin;

alter table public.worker_credentials
  add column if not exists pin_display text;

comment on column public.worker_credentials.pin_display is
  'PIN en claro para reimpresion/gestion. El login sigue usando pin_hash.';

create or replace function public.set_worker_pin(p_user uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener 4 digitos';
  end if;

  select worker_code into v_code
  from public.worker_credentials
  where user_id = p_user;

  if v_code is null then
    loop
      v_code := 'W-' || lpad((floor(random() * 100000))::int::text, 5, '0');
      exit when not exists (
        select 1 from public.worker_credentials where worker_code = v_code
      );
    end loop;
    insert into public.worker_credentials (user_id, worker_code, pin_hash, pin_display)
    values (
      p_user,
      v_code,
      extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
      p_pin
    );
  else
    update public.worker_credentials
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
        pin_display = p_pin,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where user_id = p_user;
  end if;

  return v_code;
end;
$$;

drop function if exists public.listar_trabajadores(uuid);

create or replace function public.listar_trabajadores(p_obra uuid)
returns table (
  user_id uuid,
  full_name text,
  phone text,
  empresa_id uuid,
  empresa text,
  worker_code text,
  pin text,
  bloqueado_hasta timestamptz,
  equipo_id uuid,
  equipo text,
  habilitaciones text[],
  activo boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_gestion boolean;
  v_ver boolean;
begin
  v_gestion := (select is_ceo())
    or p_obra in (select obras_with_perm('members.manage'));
  v_ver := v_gestion
    or p_obra in (select obras_with_perm('equipo.manage'));
  if not v_ver then
    raise exception 'Sin permiso para ver el personal de esta obra'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    case when v_gestion then p.phone end,
    m.empresa_id,
    e.nombre,
    case when v_gestion then wc.worker_code end,
    case when v_gestion then wc.pin_display end,
    case when v_gestion and wc.locked_until > now() then wc.locked_until end,
    em.equipo_id,
    eq.nombre,
    coalesce((
      select array_agg(mt.nombre order by mt.nombre)
      from habilitaciones h
      join maquina_tipos mt on mt.id = h.maquina_tipo_id
      where h.user_id = p.id
        and (h.valid_until is null or h.valid_until >= current_date)
    ), '{}'),
    m.active
  from obra_members m
  join profiles p on p.id = m.user_id
  left join empresas e on e.id = m.empresa_id
  left join worker_credentials wc on wc.user_id = p.id
  left join equipo_members em
    on em.obra_id = m.obra_id
    and em.user_id = m.user_id
    and em.left_at is null
  left join equipos eq on eq.id = em.equipo_id
  where m.obra_id = p_obra and m.role = 'obrero'
  order by m.active desc, p.full_name;
end;
$$;

revoke all on function public.listar_trabajadores(uuid) from public;
grant execute on function public.listar_trabajadores(uuid) to authenticated;

commit;
