-- =====================================================================
-- 11a · Nuevo valor de rol de plataforma
-- Ejecutar SOLO, antes de 11b. Postgres no deja usar un valor de enum
-- en la misma transacción en la que se crea, por eso va aparte.
-- Es inofensivo: no da acceso a nadie todavía.
-- =====================================================================
alter type public.platform_role add value if not exists 'plataforma';
