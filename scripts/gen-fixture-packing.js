import fs from "fs";

const pesos = [662, 300, 450, 280, 510, 390, 420, 350, 280, 411, 380, 370, 350];
const sum = pesos.reduce((a, b) => a + b, 0);
pesos[pesos.length - 1] += 5153 - sum;

const target = 119;
const base = Math.floor(target / 13);
let rem = target - base * 13;
const bultos = [];
let lineasTotal = 0;

for (let i = 0; i < 13; i += 1) {
  const n = base + (i < rem ? 1 : 0);
  const lineas = [];
  for (let j = 0; j < n; j += 1) {
    const primera = i === 0 && j === 0;
    lineas.push({
      lote: "13",
      referencia: primera
        ? "MONTANTES L=3794 CON MECHA"
        : `Aux. Obra-${String(i + 1).padStart(3, "0")}-${String(j + 1).padStart(2, "0")}`,
      cantidad: primera ? 20 : 1 + ((i + j) % 5),
      descripcion: primera ? "montante" : "aux",
      hoja: String(2 + (i % 3)),
      hs_code: "76109090",
    });
  }
  lineasTotal += lineas.length;
  bultos.push({
    numero: 5 + i,
    peso_bruto_kg: pesos[i],
    dimensiones:
      i === 0
        ? "4050 X 570 X 360"
        : `${1200 + i * 10} X ${800 + i * 5} X ${600 + i * 3}`,
    lineas,
  });
}

const fixture = {
  numero_envio: 6,
  fecha_carga: "2026-10-13",
  bultos_declarados: 13,
  peso_declarado_kg: 5153,
  matricula: null,
  contenedor_iso: null,
  archivo_origen: "006_OCT26.xlsx",
  bultos,
};

fs.mkdirSync("fixtures", { recursive: true });
fs.writeFileSync(
  "fixtures/fixture_packing_hotel_soho_envio6.json",
  `${JSON.stringify(fixture, null, 2)}\n`,
);
console.log({
  bultos: bultos.length,
  lineas: lineasTotal,
  peso: pesos.reduce((a, b) => a + b, 0),
});
