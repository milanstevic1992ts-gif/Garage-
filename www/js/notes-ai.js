const REPLACEMENTS = [
  [/\bx\b/gi, 'per'],
  [/\bqta\b/gi, 'quantità'],
  [/\bkm\b/gi, 'km'],
  [/\bcarb\b/gi, 'carburatore'],
  [/\bcdi\b/gi, 'centralina CDI'],
];

function cleanSentence(value) {
  let text = String(value || '').trim().replace(/\s+/g, ' ');
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  if (!text) return '';
  text = text[0].toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return text;
}

export function orderRoughNotes(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parts = raw
    .replace(/\r/g, '\n')
    .split(/\n+|[;•]+|(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter(Boolean);

  if (!parts.length) return raw;
  if (parts.length === 1) return parts[0];
  return parts.map(x => `• ${x}`).join('\n');
}

const SEARCH_HINTS = [
  { words: ['scintilla','accensione','corrente'], terms: ['candela','bobina','statore','centralina CDI'] },
  { words: ['non parte','avviamento','motorino'], terms: ['batteria','motorino avviamento','relè','candela'] },
  { words: ['frena','freno','frenata'], terms: ['pastiglie','disco freno','pinza freno'] },
  { words: ['trasmissione','strappa','slitta'], terms: ['cinghia','variatore','rulli','frizione','campana'] },
  { words: ['benzina','carburante','carburazione'], terms: ['carburatore','iniettore','pompa benzina','filtro benzina'] },
  { words: ['raffreddamento','caldo','temperatura'], terms: ['radiatore','pompa acqua','termostato'] },
];

export function suggestInventoryTerms(problemText = '') {
  const text = String(problemText).toLowerCase();
  const out = [];
  for (const group of SEARCH_HINTS) {
    if (group.words.some(word => text.includes(word))) {
      for (const term of group.terms) {
        if (!out.includes(term)) out.push(term);
      }
    }
  }
  return out.slice(0, 8);
}
