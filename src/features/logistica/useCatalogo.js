import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Catálogo tipos_modulo de la obra. 0 filas ⇒ sin catálogo (flujo ventana/panel).
 * @param {string | null | undefined} obraId
 */
export function useCatalogo(obraId) {
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(Boolean(obraId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!obraId) {
      setCatalogo([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancel = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: err } = await supabase
        .from("tipos_modulo")
        .select("id, codigo, pieza, categoria, descripcion")
        .eq("obra_id", obraId)
        .order("categoria")
        .order("codigo")
        .order("pieza");

      if (cancel) return;
      if (err) {
        setError(err.message);
        setCatalogo([]);
      } else {
        setCatalogo(data ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, [obraId]);

  return { catalogo, loading, error };
}
