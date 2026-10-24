const PAGE = 1000;

/** Página todas las filas de una consulta PostgREST (límite por defecto: 1.000). */
export async function fetchAll(makeQuery) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
