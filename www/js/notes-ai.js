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

const WORKSHOP_POLISH = [
  [/\bnon parte bene\b/gi, 'presenta difficoltà di avviamento'],
  [/\bfa fatica (?:a|ad) (?:partire|accendersi)\b/gi, 'presenta difficoltà di avviamento'],
  [/\bnon parte\b/gi, 'non si avvia'],
  [/\bsi spegne\b/gi, 'tende a spegnersi'],
  [/\bnon tiene il minimo\b/gi, 'presenta un minimo irregolare'],
  [/\bfa (?:un )?rumore\b/gi, 'presenta un rumore anomalo'],
  [/\bfrena male\b/gi, 'presenta una frenata poco efficace'],
  [/\bperde olio\b/gi, "presenta una perdita d'olio"],
  [/\bperde acqua\b/gi, 'presenta una perdita di liquido'],
  [/\bvibra molto\b/gi, 'presenta vibrazioni anomale'],
];

function polishWorkshopSentence(value, context = '') {
  let text = normalizeWorkshopDictation(value)
    .replace(/^[-–—•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (context === 'declaredProblems') {
    text = text
      .replace(/^(?:il\s+)?cliente\s+(?:dice|riferisce|segnala)(?:\s+che)?\s*/i, '')
      .replace(/^dice\s+che\s+/i, '');
  }
  if (context === 'foundProblems') {
    text = text
      .replace(/^(?:ho|abbiamo)\s+(?:visto|notato|riscontrato|trovato)(?:\s+che)?\s*/i, '');
  }

  for (const [pattern, replacement] of WORKSHOP_POLISH) {
    text = text.replace(pattern, replacement);
  }

  return cleanSentence(text);
}

export function rewriteWorkshopNotes(value = '', context = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw
    .replace(/\r/g, '\n')
    .replace(/\s+(?:poi|inoltre|in più)\s+/gi, '; ');

  let chunks = normalized
    .split(/\n+|[;•]+|(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);

  // Le note dettate spesso arrivano come una lunga frase separata da virgole.
  if (chunks.length === 1 && (normalized.match(/,/g) || []).length >= 1) {
    const commaParts = normalized.split(/,\s*/).map(x => x.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every(x => x.length >= 4)) chunks = commaParts;
  }

  const parts = chunks
    .map(x => polishWorkshopSentence(x, context))
    .filter(Boolean);

  if (!parts.length) return cleanSentence(raw);
  if (parts.length === 1) return parts[0];
  return parts.map(x => `• ${x}`).join('\n');
}

export function orderRoughNotes(value = '') {
  return rewriteWorkshopNotes(value);
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


const DICTATION_NORMALIZATIONS = [
  [/\bt\s*max\b/gi, 'TMAX'],
  [/\bcd\s*i\b/gi, 'CDI'],
  [/\be\s*cu\b/gi, 'ECU'],
  [/\bdell\s+orto\b/gi, "Dell'Orto"],
  [/\bbet\s*win\b/gi, 'Betwin'],
  [/\bliberti\b/gi, 'Liberty'],
  [/\baerox\b/gi, 'Aerox'],
  [/\bpiaggio\b/gi, 'Piaggio'],
  [/\byamaha\b/gi, 'Yamaha'],
  [/\bpeugeot\b/gi, 'Peugeot'],
  [/\bkilometri\b/gi, 'km'],
];

export function normalizeWorkshopDictation(value = '') {
  let text = String(value || '').trim().replace(/\s+/g, ' ');
  for (const [pattern, replacement] of DICTATION_NORMALIZATIONS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}
