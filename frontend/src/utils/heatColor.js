export const TEMP_MIN = 40;
export const TEMP_MAX = 180;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const h = Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');
    return h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const COLOR_STOPS = [
  { t: 0.0, color: '#3b82f6' },
  { t: 0.25, color: '#06b6d4' },
  { t: 0.45, color: '#22c55e' },
  { t: 0.65, color: '#eab308' },
  { t: 0.8, color: '#f97316' },
  { t: 0.9, color: '#ef4444' },
  { t: 1.0, color: '#dc2626' },
];

export function getHeatColor(temperature, tempMin = TEMP_MIN, tempMax = TEMP_MAX) {
  const t = Math.max(0, Math.min(1, (temperature - tempMin) / (tempMax - tempMin)));

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const start = COLOR_STOPS[i];
    const end = COLOR_STOPS[i + 1];
    if (t >= start.t && t <= end.t) {
      const localT = (t - start.t) / (end.t - start.t);
      const startRgb = hexToRgb(start.color);
      const endRgb = hexToRgb(end.color);
      const r = lerp(startRgb.r, endRgb.r, localT);
      const g = lerp(startRgb.g, endRgb.g, localT);
      const b = lerp(startRgb.b, endRgb.b, localT);
      return rgbToHex(r, g, b);
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}

export function getHeatColorRgb(temperature, tempMin = TEMP_MIN, tempMax = TEMP_MAX) {
  const hex = getHeatColor(temperature, tempMin, tempMax);
  const { r, g, b } = hexToRgb(hex);
  return { r, g, b };
}
