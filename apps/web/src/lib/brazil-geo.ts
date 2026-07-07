const MIN_LAT = 1;
const MAX_LAT = -33;
const MIN_LNG = -73;
const MAX_LNG = -34;

export const BRAZIL_VIEWBOX = { width: 500, height: 520 };

/** Contorno simplificado do Brasil (lng, lat) */
const BRAZIL_BORDER: [number, number][] = [
  [-59.0, 1.0],
  [-50.0, 0.5],
  [-44.0, -1.0],
  [-38.0, -3.0],
  [-35.0, -5.0],
  [-34.8, -7.5],
  [-35.0, -9.5],
  [-37.0, -11.5],
  [-38.5, -13.0],
  [-39.0, -17.0],
  [-41.0, -21.0],
  [-43.0, -23.0],
  [-46.0, -24.0],
  [-48.5, -25.5],
  [-51.0, -28.0],
  [-53.5, -31.0],
  [-57.0, -33.0],
  [-60.5, -33.0],
  [-63.0, -31.5],
  [-65.5, -29.5],
  [-68.0, -27.0],
  [-70.5, -24.0],
  [-72.5, -20.0],
  [-73.0, -14.0],
  [-72.5, -8.0],
  [-70.5, -4.0],
  [-66.5, -1.0],
  [-63.0, 0.5],
  [-59.0, 1.0],
];

export const BR_STATE_COORDS: Record<string, { lat: number; lng: number; capital: string }> = {
  AC: { lat: -9.974, lng: -67.81, capital: 'Rio Branco' },
  AL: { lat: -9.665, lng: -35.735, capital: 'Maceió' },
  AM: { lat: -3.119, lng: -60.021, capital: 'Manaus' },
  AP: { lat: 0.034, lng: -51.069, capital: 'Macapá' },
  BA: { lat: -12.971, lng: -38.501, capital: 'Salvador' },
  CE: { lat: -3.717, lng: -38.543, capital: 'Fortaleza' },
  DF: { lat: -15.794, lng: -47.882, capital: 'Brasília' },
  ES: { lat: -20.315, lng: -40.312, capital: 'Vitória' },
  GO: { lat: -16.686, lng: -49.265, capital: 'Goiânia' },
  MA: { lat: -2.529, lng: -44.302, capital: 'São Luís' },
  MG: { lat: -19.916, lng: -43.934, capital: 'Belo Horizonte' },
  MS: { lat: -20.469, lng: -54.62, capital: 'Campo Grande' },
  MT: { lat: -15.601, lng: -56.097, capital: 'Cuiabá' },
  PA: { lat: -1.456, lng: -48.504, capital: 'Belém' },
  PB: { lat: -7.12, lng: -34.863, capital: 'João Pessoa' },
  PE: { lat: -8.047, lng: -34.877, capital: 'Recife' },
  PI: { lat: -5.089, lng: -42.801, capital: 'Teresina' },
  PR: { lat: -25.429, lng: -49.267, capital: 'Curitiba' },
  RJ: { lat: -22.906, lng: -43.173, capital: 'Rio de Janeiro' },
  RN: { lat: -5.794, lng: -35.211, capital: 'Natal' },
  RO: { lat: -8.761, lng: -63.903, capital: 'Porto Velho' },
  RR: { lat: 2.823, lng: -60.675, capital: 'Boa Vista' },
  RS: { lat: -30.034, lng: -51.217, capital: 'Porto Alegre' },
  SC: { lat: -27.595, lng: -48.548, capital: 'Florianópolis' },
  SE: { lat: -10.909, lng: -37.074, capital: 'Aracaju' },
  SP: { lat: -23.55, lng: -46.633, capital: 'São Paulo' },
  TO: { lat: -10.184, lng: -48.333, capital: 'Palmas' },
};

export function projectLatLng(lat: number, lng: number) {
  const { width, height } = BRAZIL_VIEWBOX;
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * width;
  const y = ((MIN_LAT - lat) / (MIN_LAT - MAX_LAT)) * height;
  return { x, y };
}

export function getBrazilOutlinePath() {
  const points = BRAZIL_BORDER.map(([lng, lat]) => projectLatLng(lat, lng));
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
}

export function formatPartnerLocation(city?: string | null, state?: string | null) {
  const parts = [city, state].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'Localização não informada';
}

export function getPartnerCoords(state?: string | null, indexInState = 0) {
  if (!state) return null;
  const normalized = state.trim().toUpperCase();
  const base = BR_STATE_COORDS[normalized];
  if (!base) return null;

  const { x, y } = projectLatLng(base.lat, base.lng);
  const angle = (indexInState * 137.5 * Math.PI) / 180;
  const radius = indexInState === 0 ? 0 : 10 + indexInState * 4;
  return {
    x: x + Math.cos(angle) * radius,
    y: y + Math.sin(angle) * radius,
    state: normalized,
    capital: base.capital,
  };
}
