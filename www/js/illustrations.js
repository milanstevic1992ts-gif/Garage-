// Illustrazioni vettoriali originali di auto, moto e scooter.
// Nessun id interno: più disegni possono stare nella stessa pagina senza conflitti.

export const VEHICLE_COLORS = {
  rosso:   { label: 'Rosso',   hex: '#c8352b' },
  arancio: { label: 'Arancio', hex: '#ff6a18' },
  giallo:  { label: 'Giallo',  hex: '#e7b421' },
  verde:   { label: 'Verde',   hex: '#2f8f55' },
  blu:     { label: 'Blu',     hex: '#2f63b8' },
  azzurro: { label: 'Azzurro', hex: '#5aa7d8' },
  bianco:  { label: 'Bianco',  hex: '#e9edf0' },
  grigio:  { label: 'Grigio',  hex: '#8c969f' },
  nero:    { label: 'Nero',    hex: '#2b3036' },
};

export const VEHICLE_TYPES = {
  scooter: 'Scooter',
  moto: 'Moto',
  auto: 'Auto',
};

const CAR_WORDS = /\b(fiat|panda|punto|500|lancia|ypsilon|alfa|giulietta|volkswagen|vw|golf|polo|toyota|yaris|renault|clio|peugeot 2\d\d|peugeot 3\d\d|citroen|c3|opel|corsa|ford|fiesta|focus|dacia|sandero|skoda|audi|bmw serie|mercedes|smart|kia|hyundai|suzuki swift|jeep|mini cooper|tesla)\b/i;
const MOTO_WORDS = /\b(ducati|monster|kawasaki|ninja|z\d{3,4}|triumph|ktm|duke|aprilia rs|tuono|mt-?\d+|r1|r6|cbr|hornet|gsx|v-?strom|guzzi|harley|bmw r|bmw gs|africa twin|tracer|tenere|moto)\b/i;

export function guessType(vehicle = {}) {
  if (VEHICLE_TYPES[vehicle.vehicleType]) return vehicle.vehicleType;
  const text = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  if (CAR_WORDS.test(text)) return 'auto';
  if (MOTO_WORDS.test(text)) return 'moto';
  return 'scooter';
}

export function colorHex(vehicle = {}) {
  return VEHICLE_COLORS[vehicle.color]?.hex || '#8c969f';
}

const METAL = '#b9c2ca';
const DARK = '#1a1f25';
const ENGINE = '#2c343c';

function wheel(cx, cy, r, spokes = 5) {
  const rim = r * 0.66;
  const lines = [];
  for (let i = 0; i < spokes; i++) {
    const a = (Math.PI * 2 * i) / spokes - Math.PI / 2;
    lines.push(`M${cx} ${cy}L${(cx + Math.cos(a) * rim * 0.92).toFixed(1)} ${(cy + Math.sin(a) * rim * 0.92).toFixed(1)}`);
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0a0d11"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 2.5}" fill="none" stroke="#252c33" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="${rim}" fill="#12171c" stroke="${METAL}" stroke-width="2.4"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="none" stroke="#5d6770" stroke-width="2.6" stroke-dasharray="1.6 1.8"/>
    <path d="${lines.join('')}" stroke="${METAL}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.16}" fill="#d9dfe4"/>`;
}

const shadow = (cx = 120, rx = 104) =>
  `<ellipse cx="${cx}" cy="131" rx="${rx}" ry="5.5" fill="#000" opacity=".5"/>`;

function moto() {
  return `
    ${shadow(122, 96)}
    <path d="M66 104 116 86l4 8-50 16z" fill="#3a434c"/>
    <path d="M86 94 100 64" stroke="#e7b421" stroke-width="4" stroke-dasharray="2.2 1.6"/>
    ${wheel(64, 100, 28)}
    <path d="M100 70h40l9 12v17c0 6-4 9-9 9h-33c-7 0-10-4-11-9z" fill="${ENGINE}"/>
    <path d="M108 76h26M108 81h26M108 86h26" stroke="#48525b" stroke-width="2"/>
    <path d="M122 104c-18 6-40 5-54-2" fill="none" stroke="#7d868f" stroke-width="5" stroke-linecap="round"/>
    <path d="M66 86l32-8c4-1 7 1 8 5s-1 7-5 8l-32 8c-4 1-7-1-8-5s1-7 5-8z" fill="${METAL}"/>
    <path d="M67 89l32-8" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="64" cy="93" rx="3" ry="5.5" transform="rotate(-14 64 93)" fill="#1a1f25"/>
    <rect x="140" y="62" width="10" height="22" rx="2" fill="#20262c" stroke="#3b444c" stroke-width="1.5"/>
    <path d="M142 67h6M142 72h6M142 77h6" stroke="#48525b" stroke-width="1.3"/>
    <path d="M112 106h10" stroke="#5d6770" stroke-width="3" stroke-linecap="round"/>
    <path d="M163 44 120 60l-4 28M163 44l-22 38-25 6M120 60l21 22" fill="none" stroke="#4d5760" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 52l30 6-3 9-18-2z" fill="var(--body)"/>
    <rect x="37" y="50" width="6" height="5" rx="1.5" fill="#e0443a"/>
    <path d="M64 60c16-6 38-7 58-4l-2 7c-18 0-38 2-54 4z" fill="${DARK}"/>
    <path d="M68 59c15-4 34-5 50-3" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M117 55c4-15 32-19 47-11l-4 14c-12 5-31 7-43 2z" fill="var(--body)"/>
    <path d="M123 50c6-7 22-9 34-5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M117 55c10 4 30 3 43-3l0 6c-12 5-31 7-43 2z" fill="#000" opacity=".22"/>
    ${wheel(184, 100, 28)}
    <path d="M165 43 183 100" stroke="${METAL}" stroke-width="6" stroke-linecap="round"/>
    <path d="M173 70 183 100" stroke="#6b747c" stroke-width="6" stroke-linecap="round"/>
    <path d="M163 79q20-15 39-3l-2 5q-18-10-35 3z" fill="var(--body)"/>
    <path d="M148 35l20 4" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M152 35l-5-10" stroke="${DARK}" stroke-width="2"/>
    <ellipse cx="146" cy="23" rx="4" ry="2.5" fill="${DARK}"/>
    <circle cx="175" cy="50" r="8" fill="#2a3138"/>
    <circle cx="176.5" cy="50" r="5.5" fill="#f3f6f8"/>
`;
}

function scooter() {
  return `
    ${shadow(118, 94)}
    <path d="M62 96h40l-4 13-32 2z" fill="${ENGINE}"/>
    <path d="M86 106H50" stroke="#7d868f" stroke-width="5" stroke-linecap="round"/>
    ${wheel(66, 108, 22)}
    <path d="M100 92h50v6l-54 3z" fill="#2a3138"/>
    <path d="M28 60c14-5 52-6 88-1 12 2 18 12 20 30l-8 7-30 3c-4-12-14-20-28-20s-24 8-30 18c-8-8-12-22-12-37z" fill="var(--body)"/>
    <path d="M40 97c6-10 16-18 30-18s24 8 28 20l30-3 8-7c0 4-1 6-2 8l-7 6-30 3c-3-11-14-19-27-19s-22 7-26 17z" fill="#000" opacity=".22"/>
    <path d="M34 62c14-4 48-5 80-1" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 58l8-2 1 7-7 2z" fill="#e0443a"/>
    <path d="M36 54c6-3 12-3 17-1" stroke="${METAL}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M46 54c12-12 54-12 72-2l-3 7c-20-5-48-3-64 1z" fill="${DARK}"/>
    <path d="M52 51c12-7 42-7 60-1" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M147 97c3-26 10-46 23-60l11 2c-11 18-17 38-19 58z" fill="var(--body)"/>
    <path d="M166 42c-7 14-11 30-12 52" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M174 44 178 108" stroke="${METAL}" stroke-width="5" stroke-linecap="round"/>
    ${wheel(178, 108, 22)}
    <path d="M163 93q15-12 32-2l-2 5q-14-8-28 3z" fill="var(--body)"/>
    <path d="M169 30l5-16h7l2 16z" fill="#a9c1d3" opacity=".4"/>
    <path d="M160 30h26l5 9-25 2z" fill="var(--body)"/>
    <path d="M160 30h26l5 9-25 2z" fill="#000" opacity=".12"/>
    <ellipse cx="189" cy="36" rx="4.5" ry="3" fill="#f3f6f8"/>
    <path d="M160 31l-6-10" stroke="${DARK}" stroke-width="2"/>
    <ellipse cx="153" cy="20" rx="4" ry="2.5" fill="${DARK}"/>`;
}

function auto() {
  return `
    ${shadow(122, 108)}
    <path d="M22 103l2-19c2-10 12-14 26-16l20-18c6-6 14-8 26-8h54c10 0 18 4 26 12l18 16c18 2 28 8 28 20v14c0 4-4 6-8 6h-14a21 21 0 0 0-40 0H84a21 21 0 0 0-40 0H28c-4 0-6-3-6-7z" fill="var(--body)"/>
    <path d="M22 96h200v7c0 4-4 7-8 7h-14a21 21 0 0 0-40 0H84a21 21 0 0 0-40 0H28c-4 0-6-3-6-7z" fill="#000" opacity=".28"/>
    <path d="M58 66l16-14c4-4 10-5 18-5h16v19z" fill="#18222c"/>
    <path d="M114 47h36c8 0 14 3 20 9l10 10h-66z" fill="#18222c"/>
    <path d="M120 64l14-15h8l-14 15zM66 64l10-9h6l-10 9z" fill="#fff" opacity=".12"/>
    <path d="M30 80h184" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>
    <path d="M111 70v34" stroke="#000" stroke-opacity=".28" stroke-width="1.5"/>
    <rect x="96" y="75" width="10" height="3" rx="1.5" fill="#000" opacity=".35"/>
    <rect x="148" y="75" width="10" height="3" rx="1.5" fill="#000" opacity=".35"/>
    <path d="M172 60h8l2 6h-10z" fill="${DARK}"/>
    <path d="M206 73l14 6-3 5-13-4z" fill="#f3f6f8"/>
    <rect x="22" y="75" width="6" height="11" rx="2" fill="#e0443a"/>
    ${wheel(64, 111, 19, 6)}
    ${wheel(180, 111, 19, 6)}`;
}

const DRAW = { moto, scooter, auto };

export function vehicleSvg(type = 'scooter', color = '#8c969f', className = '') {
  const draw = DRAW[type] || scooter;
  return `<svg class="vehicle-art ${className}" viewBox="0 0 240 140" style="--body:${color}" role="img" aria-label="${VEHICLE_TYPES[type] || 'Veicolo'}">${draw()}</svg>`;
}

export function vehicleArt(vehicle, className = '') {
  return vehicleSvg(guessType(vehicle), colorHex(vehicle), className);
}

const PART_RULES = [
  ['belt',  /cinghi|trasmission|variator|rull|frizion|campana|puleg/i],
  ['spark', /candel|elettric|cdi|centralin|bobin|batteri|regolator|statore|lampad|fusibil|rel[eè]/i],
  ['brake', /fren|pastigli|disco|pinz|ganasc/i],
  ['tire',  /gomm|pneumatic|ruot|camera d|cerchi/i],
  ['oil',   /olio|filtr|lubrif|liquid/i],
  ['carb',  /carbur|aliment|iniett|benzin|pompa|getto|spillo/i],
];

export function partKind(item = {}) {
  const text = [item.category, item.name].filter(Boolean).join(' ');
  return (PART_RULES.find(([, rx]) => rx.test(text)) || ['bolt'])[0];
}

const PARTS = {
  carb: `
    <rect x="34" y="24" width="52" height="16" rx="7" fill="#3ea353"/>
    <path d="M40 40h40l8 26-10 26H42L32 66z" fill="${METAL}"/>
    <path d="M44 44h32" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>
    <rect x="14" y="58" width="22" height="16" rx="5" fill="#7d878f"/>
    <rect x="84" y="59" width="22" height="14" rx="5" fill="#7d878f"/>
    <circle cx="60" cy="66" r="11" fill="#58636b" stroke="#dfe5e9" stroke-width="3"/>
    <path d="M48 92v10h24V92" fill="#7f8990"/>`,
  belt: `
    <rect x="16" y="30" width="88" height="60" rx="30" fill="none" stroke="#2b3036" stroke-width="12"/>
    <rect x="16" y="30" width="88" height="60" rx="30" fill="none" stroke="#4a525a" stroke-width="12" stroke-dasharray="3 5"/>
    <circle cx="46" cy="60" r="20" fill="${METAL}"/><circle cx="46" cy="60" r="6" fill="#2c343c"/>
    <circle cx="80" cy="60" r="13" fill="#9aa3ab"/><circle cx="80" cy="60" r="4" fill="#2c343c"/>`,
  spark: `
    <rect x="52" y="12" width="16" height="12" rx="3" fill="#9aa3ab"/>
    <path d="M48 24h24l-3 36H51z" fill="#eef1f3"/>
    <path d="M54 30h4v26h-4z" fill="#fff" opacity=".6"/>
    <path d="M44 60h32l-4 10h-24z" fill="${METAL}"/>
    <path d="M46 72h28M46 78h28M46 84h28M48 90h24" stroke="#7d878f" stroke-width="4"/>
    <path d="M58 96v8h8" stroke="#dfe5e9" stroke-width="3" fill="none"/>
    <path d="M86 18l-8 14h8l-8 14" stroke="#ff9b43" stroke-width="3" fill="none" stroke-linejoin="round"/>`,
  brake: `
    <circle cx="56" cy="62" r="40" fill="${METAL}"/>
    <circle cx="56" cy="62" r="40" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <circle cx="56" cy="62" r="17" fill="#5d6770"/>
    <g fill="#12171c">${[0,1,2,3,4,5,6,7].map(i => { const a = i * Math.PI / 4; return `<circle cx="${(56 + Math.cos(a) * 28).toFixed(1)}" cy="${(62 + Math.sin(a) * 28).toFixed(1)}" r="2.6"/>`; }).join('')}</g>
    <circle cx="56" cy="62" r="5" fill="#dfe5e9"/>
    <path d="M84 30c14 6 22 20 20 38l-14-2c1-12-4-20-12-24z" fill="#d23a2a"/>`,
  tire: `
    <circle cx="60" cy="60" r="44" fill="#14181c"/>
    <circle cx="60" cy="60" r="44" fill="none" stroke="#2c333a" stroke-width="7" stroke-dasharray="4 4"/>
    <circle cx="60" cy="60" r="27" fill="#20262c" stroke="${METAL}" stroke-width="4"/>
    <circle cx="60" cy="60" r="7" fill="#dfe5e9"/>`,
  oil: `
    <path d="M36 34h40l10 12v56c0 3-2 5-5 5H36c-3 0-5-2-5-5V39c0-3 2-5 5-5z" fill="#e7b421"/>
    <rect x="48" y="20" width="16" height="14" rx="3" fill="#2b3036"/>
    <rect x="38" y="56" width="42" height="30" rx="4" fill="#1a1f25"/>
    <path d="M59 62c-6 8-8 11-8 14a8 8 0 0 0 16 0c0-3-2-6-8-14z" fill="#e7b421"/>
    <path d="M38 42v56" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`,
  bolt: `
    <path d="M60 16l30 17v34L60 84 30 67V33z" fill="${METAL}"/>
    <path d="M60 16l30 17-30 17-30-17z" fill="#dfe5e9"/>
    <circle cx="60" cy="33" r="9" fill="#5d6770"/>
    <rect x="52" y="78" width="16" height="30" rx="3" fill="#9aa3ab"/>
    <path d="M52 86h16M52 93h16M52 100h16" stroke="#5d6770" stroke-width="2.5"/>`,
};

export function partSvg(item, className = '') {
  const kind = partKind(item);
  return `<svg class="part-art ${className}" viewBox="0 0 120 120" role="img" aria-hidden="true">${PARTS[kind]}</svg>`;
}

export function heroSvg() {
  const slats = Array.from({ length: 7 }, (_, i) => `<path d="M0 ${8 + i * 7}H420" stroke="#1d252d" stroke-width="3"/>`).join('');
  const floor = Array.from({ length: 9 }, (_, i) => {
    const x = -40 + i * 62;
    return `<path d="M210 212L${x} 300" stroke="#fff" stroke-opacity=".035" stroke-width="1.5"/>`;
  }).join('');
  const place = (type, color, x, y, w, extra = '') =>
    `<svg x="${x}" y="${y}" width="${w}" height="${(w * 140) / 240}" viewBox="0 0 240 140" style="--body:${color}" ${extra}>${DRAW[type]()}</svg>`;

  return `
  <svg class="hero-art" viewBox="0 0 420 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="gh-wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#141c24"/><stop offset="1" stop-color="#0b1015"/></linearGradient>
      <linearGradient id="gh-floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#171d23"/><stop offset="1" stop-color="#090c10"/></linearGradient>
      <radialGradient id="gh-pool" cx=".5" cy=".5" r=".5"><stop stop-color="#ffb070" stop-opacity=".32"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient>
      <linearGradient id="gh-cone" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffd2a8" stop-opacity=".22"/><stop offset="1" stop-color="#ffd2a8" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="420" height="300" fill="url(#gh-wall)"/>
    <g>${slats}</g>
    <rect y="54" width="420" height="4" fill="#232c35"/>
    <g opacity=".75">
      <rect x="304" y="86" width="96" height="92" rx="4" fill="#161d24" stroke="#26303a" stroke-width="2"/>
      <g fill="#26303a">${Array.from({ length: 40 }, (_, i) => `<circle cx="${314 + (i % 8) * 11}" cy="${96 + Math.floor(i / 8) * 17}" r="1.4"/>`).join('')}</g>
      <path d="M318 100v46m-6-46h12" stroke="#7d868f" stroke-width="4" stroke-linecap="round"/>
      <path d="M340 98v40" stroke="#7d868f" stroke-width="4" stroke-linecap="round"/><path d="M336 138h8l-2 20h-4z" fill="#ff6a18"/>
      <path d="M360 100l0 34" stroke="#9aa3ab" stroke-width="5" stroke-linecap="round"/><circle cx="360" cy="100" r="7" fill="none" stroke="#9aa3ab" stroke-width="4"/>
      <path d="M380 98v30" stroke="#7d868f" stroke-width="3"/><rect x="372" y="94" width="16" height="9" rx="2" fill="#9aa3ab"/>
    </g>
    <g opacity=".6">
      <rect x="20" y="92" width="70" height="86" rx="4" fill="#161d24" stroke="#26303a" stroke-width="2"/>
      <path d="M20 121h70M20 150h70" stroke="#26303a" stroke-width="2"/>
      <rect x="28" y="104" width="16" height="17" rx="2" fill="#e7b421"/><rect x="48" y="108" width="12" height="13" rx="2" fill="#2f63b8"/>
      <circle cx="74" cy="140" r="9" fill="#1a1f25" stroke="#3a434c" stroke-width="3"/>
    </g>
    <path d="M210 0v70" stroke="#2c343c" stroke-width="2"/>
    <path d="M196 70h28l8 12h-44z" fill="#2c343c"/>
    <path d="M190 82h40L330 250H90z" fill="url(#gh-cone)"/>
    <ellipse cx="210" cy="83" rx="14" ry="3" fill="#ffe3c4"/>
    <rect y="212" width="420" height="88" fill="url(#gh-floor)"/>
    <path d="M0 212H420" stroke="#27313a" stroke-width="2"/>
    ${floor}
    <ellipse cx="210" cy="262" rx="150" ry="26" fill="url(#gh-pool)"/>
    ${place('auto', '#8c969f', -52, 150, 200, 'opacity=".55"')}
    ${place('scooter', '#5aa7d8', 286, 164, 170, 'opacity=".8"')}
    <rect x="112" y="258" width="196" height="8" rx="3" fill="#ff6a18"/>
    <rect x="124" y="266" width="10" height="20" fill="#2c343c"/><rect x="286" y="266" width="10" height="20" fill="#2c343c"/>
    ${place('moto', '#ff6a18', 96, 136, 228)}
  </svg>`;
}
