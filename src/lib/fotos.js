import imageCompression from "browser-image-compression";
import { supabase } from "./supabase";

/**
 * Comprime, sube a Storage y registra la foto.
 * Destino: al menos uno de { contenedorId, moduloId, incidenciaId, statusEventId }.
 */
export async function subirFoto(file, { obraId, contenedorId, moduloId, incidenciaId, statusEventId }) {
  const takenAt = file.lastModified ? new Date(file.lastModified).toISOString() : null;

  const comprimida = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    fileType: "image/jpeg",
    useWebWorker: true,
  });

  // El primer segmento del path DEBE ser el obra_id (lo exigen la RLS y un CHECK)
  const path = `${obraId}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("fotos")
    .upload(path, comprimida, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("fotos")
    .insert({
      obra_id: obraId,
      storage_path: path,
      taken_at: takenAt,
      contenedor_id: contenedorId ?? null,
      modulo_id: moduloId ?? null,
      incidencia_id: incidenciaId ?? null,
      status_event_id: statusEventId ?? null,
    })
    .select()
    .single();
  if (error) throw error; // el archivo queda huérfano en Storage; se limpia con un job

  return data;
}

// URL firmada temporal (el bucket es privado)
export async function urlFoto(storagePath, segundos = 3600) {
  const { data, error } = await supabase.storage.from("fotos").createSignedUrl(storagePath, segundos);
  if (error) throw error;
  return data.signedUrl;
}
