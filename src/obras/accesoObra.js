/**
 * v_mis_obras.mi_rol marca control total en esta obra
 * (dueño de la organización, o la plataforma).
 */
export function controlTotalEnObra(mi_rol) {
  return mi_rol === "ceo";
}
