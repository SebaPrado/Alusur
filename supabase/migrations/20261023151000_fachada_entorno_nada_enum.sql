-- =====================================================================
-- CÓMO EJECUTAR: pegar TODO en Supabase → SQL Editor → Run.
-- Va dentro de una transacción: si algo falla, no se aplica nada.
-- Al final se registra en el historial de migraciones.
-- =====================================================================
--
-- Si corriste fachada_modo sin haber corrido fachada_entorno_nada, el
-- enum cara_entorno sigue sin el valor 'nada' y guardar_fachada rechaza
-- Mar/Calle/Parque/Nada aunque la UI lo ofrezca.
-- =====================================================================
begin;

do $fix$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cara_entorno'
      and e.enumlabel = 'nada'
  ) then
    execute 'alter type public.cara_entorno add value ''nada''';
  end if;
end
$fix$;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261023151000', 'fachada_entorno_nada_enum')
on conflict (version) do nothing;

commit;
