-- Lista de obras del usuario autenticado (CEO: todas; resto: vía RLS + membresía).
begin;

create or replace view public.v_mis_obras
with (security_invoker = true) as
select
  o.id,
  o.nombre,
  o.ubicacion,
  case when (select public.is_ceo()) then 'ceo' else m.role::text end as mi_rol,
  (select count(*) from public.modulos x where x.obra_id = o.id)                                           as modulos_total,
  (select count(*) from public.modulos x where x.obra_id = o.id and x.estado in ('instalado','terminado')) as modulos_instalados,
  (select count(*) from public.incidencias i where i.obra_id = o.id and i.estado <> 'cerrada')             as incidencias_abiertas
from public.obras o
left join public.obra_members m
  on m.obra_id = o.id and m.user_id = (select auth.uid()) and m.active
where o.activa;

grant select on public.v_mis_obras to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261023150000', 'v_mis_obras')
on conflict (version) do nothing;

commit;
