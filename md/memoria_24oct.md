# Excel de obra (REV5) → modelo de datos

_Cipriani Torre 1 · 24/10/2026 · Todo ejecutado en Supabase_

Este documento **reemplaza la sección 3 de `FACHADA_Y_3D.md`** para las obras con Excel de alzados: la grilla ya no sale de `secuencia`, sale de `posiciones`.

## Qué se hizo

| # | Script | Qué deja en la base |
|---|---|---|
| 1 | `01_tipos_modulo.sql` | `tipos_modulo`: 20 tipos de ALUMAN (código, `pieza` principal/complemento, categoría ventana/panel, partida, medidas, €/m², `cantidad_prevista`). `m2_unidad` y `valor_unitario` son columnas generadas. `modulos.tipo_modulo_id` (nullable) |
| 2 | `02_limpieza_y_trigger_tipo.sql` | Borrados los 31 módulos de prueba de Cipriani. Trigger `modulos_sync_tipo`: `modulos.tipo` se copia del catálogo y el tipo tiene que ser de la misma obra |
| 3 | `03_posiciones.sql` | `posiciones`: 2.545 huecos reales (cara, piso, nivel principal/cubrelosa/coronacion, eje 1–12, cota, tipo exigido). Cuadran 1:1 con el catálogo |
| 4 | `04_modulo_posiciones_enlace.sql` | `modulo_posiciones.posicion_id` y `pieza`. Trigger `modulo_posiciones_sync`: resuelve el hueco por coordenadas, copia cara/piso/eje, valida obra y código; un hueco = 1 principal + 1 complemento como máximo |
| 5 | `05_vista_torre.sql` | Vista `v_torre` (`security_invoker`): una fila por hueco con tipo, módulo, `estado_celda`, `requiere_complemento`, `tiene_complemento` |
| 6 | `06_asignar_posiciones_guardia.sql` | (Reemplazado por 7a) Guardia provisoria para que el import no fallara en Cipriani |
| 7a | `07a_asignar_posiciones_por_codigo.sql` | `asignar_posiciones`: en obras con `posiciones`, cada módulo con `tipo_modulo_id` va al primer hueco libre de su código (piso, cara, nivel, eje); la corrediza va con su terraza. Obras sin posiciones: igual que antes |
| 7b | `07b_import_con_codigo.sql` | `import_contenedor` acepta `codigo_tipo` (+ `pieza` opcional) por módulo. Obligatorio en obras con catálogo; ignora espacios/mayúsculas; código desconocido = el import entero falla con mensaje claro. Obras sin catálogo: igual que antes |

## Convenciones

- **Eje 1–12**, de izquierda a derecha mirando la cara desde fuera: 1 = esquina, pares = vanos, impares 3–11 = columnas.
- **Pisos 1–55**, como el Excel. `coronacion` = fila superior (cota 243) que el Excel rotula "PISO 55".
- Celda sin fila en `posiciones` = no hay nada (pisos 1–2 de Sur, etc.), distinto de "hueco vacío".
- Terrazas (CE10.2/3/4): el hueco lleva el módulo (`principal`) y la ventana corrediza (`complemento`), mismo código.
- Fuera del modelo por ahora: REV. GRC, MEP, cortafuego, parasoles, celosías, barandas.

## Supuestos (a confirmar cuando haya datos reales)

- Piezas con el mismo código son intercambiables → la posición es **prevista** y el obrero la confirma al instalar.
- Orden de llenado previsto: de abajo hacia arriba (piso, cara N-E-S-O, eje).
- El packing list trae el código sin espacios, en una columna "código"/"tipo"; la corrediza se distingue con una columna "pieza".

## Pendiente

1. ~~Front de la torre desde `v_torre`~~ → hecho por Cursor (`claude/CURSOR_TORRE_POSICIONES.md`). Posible detalle: la torre parece flotar un piso (zócalo calculado con `piso_desde`).
2. **Diálogos de alta con código de catálogo** → `claude/CURSOR_IMPORT_CODIGO.md` (enviado a Cursor).
3. **Historial de ocupación:** `modulo_posiciones` tiene `modulo_id` como clave; una sustitución pierde quién estuvo en el hueco. Importa para reclamaciones.
4. Anchos reales por eje en `Torre3D` (vano 3,1 m, columna 2,2 m, esquina 4,0 m) desde `tipos_modulo.ancho_m`.
5. Limpieza: obras "Cipriani (prueba 23/10 …)", fotos huérfanas en Storage, `fachada_caras.modulos_por_piso` (dice 10; en Cipriani son 12, aunque con posiciones no se usa).