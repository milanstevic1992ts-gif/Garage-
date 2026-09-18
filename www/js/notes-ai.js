const REPLACEMENTS = [
  [/\bx\b/gi, 'per'],
  [/\bqta\b/gi, 'quantità'],
  [/\bkm\b/gi, 'km'],
  [/\bcarb\b/gi, 'carburatore'],
  [/\bcdi\b/gi, 'centralina CDI'],
];

function cleanSentence(value) {
  let text = String(value || '').trim().replace(/\s+/g, ' ');
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  if (!text) return '';
  text = text[0].toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return text;
}

const WORKSHOP_POLISH = [
  [/\bnon parte bene\b/gi, 'presenta difficoltà di avviamento'],
  [/\bparte male\b/gi, 'presenta difficoltà di avviamento'],
  [/\bparte a fatica\b/gi, 'presenta difficoltà di avviamento'],
  [/\bfa fatica (?:a|ad) (?:partire|accendersi)\b/gi, 'presenta difficoltà di avviamento'],
  [/\bnon parte\b/gi, 'non si avvia'],
  [/\bsi spegne\b/gi, 'tende a spegnersi'],
  [/\bnon tiene il minimo\b/gi, 'presenta un minimo irregolare'],
  [/\bfa (?:un )?rumore\b/gi, 'presenta un rumore anomalo'],
  [/\bfrena male\b/gi, 'presenta una frenata poco efficace'],
  [/\bperde olio\b/gi, "presenta una perdita d'olio"],
  [/\bperde acqua\b/gi, 'presenta una perdita di liquido'],
  [/\bvibra molto\b/gi, 'presenta vibrazioni anomale'],
  [/\bfa fumo\b/gi, 'emette fumo anomalo'],
  [/\bconsuma olio\b/gi, 'presenta un consumo anomalo di olio'],
  [/\bsi sente puzza di benzina\b/gi, 'si avverte odore di benzina'],
  [/\bla batteria si scarica\b/gi, 'la batteria tende a scaricarsi'],
  [/\bnon carica la batteria\b/gi, 'il sistema di ricarica non carica correttamente la batteria'],
  [/\bsterzo duro\b/gi, 'lo sterzo risulta duro'],
  [/\btira a destra\b/gi, 'il mezzo tende a deviare verso destra'],
  [/\btira a sinistra\b/gi, 'il mezzo tende a deviare verso sinistra'],
];

function stripFillers(value) {
  return String(value || '')
    .replace(/\b(?:praticamente|tipo|diciamo|insomma|cioè|allora)\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function polishWorkshopSentence(value, context = '') {
  let text = stripFillers(normalizeWorkshopDictation(value))
    .replace(/^[-–—•\s]+/, '')
    .trim();

  if (context === 'declaredProblems') {
    text = text
      .replace(/^(?:il\s+)?cliente\s+(?:dice|riferisce|segnala)(?:\s+che)?\s*/i, '')
      .replace(/^dice\s+che\s+/i, '')
      .replace(/^mi dice(?:\s+che)?\s*/i, '');
  }

  if (context === 'foundProblems') {
    text = text
      .replace(/^(?:ho|abbiamo)\s+(?:visto|notato|riscontrato|trovato)(?:\s+che)?\s*/i, '')
      .replace(/^risulta\s+che\s+/i, '');
  }

  if (context === 'workDone') {
    text = text
      .replace(/^(?:ho|abbiamo)\s+/i, '')
      .replace(/^cambiato\s+/i, 'Sostituito ')
      .replace(/^cambiata\s+/i, 'Sostituita ')
      .replace(/^cambiati\s+/i, 'Sostituiti ')
      .replace(/^cambiate\s+/i, 'Sostituite ')
      .replace(/^messo\s+/i, 'Installato ')
      .replace(/^messa\s+/i, 'Installata ')
      .replace(/^fatto\s+/i, 'Eseguito ')
      .replace(/^fatta\s+/i, 'Eseguita ');
  }

  if (context === 'customerNotes') {
    text = text
      .replace(/^dire al cliente(?:\s+che)?\s*/i, '')
      .replace(/^avvisare il cliente(?:\s+che)?\s*/i, '')
      .replace(/^comunicare al cliente(?:\s+che)?\s*/i, '');
  }

  for (const [pattern, replacement] of WORKSHOP_POLISH) text = text.replace(pattern, replacement);
  return cleanSentence(text);
}

function splitRoughNotes(raw) {
  const normalized = String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/\s+(?:poi|inoltre|in più|dopodiché|successivamente|e poi)\s+/gi, '; ');

  let chunks = normalized
    .split(/\n+|[;•]+|(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);

  if (chunks.length === 1 && (normalized.match(/,/g) || []).length >= 1) {
    const commaParts = normalized.split(/,\s*/).map(x => x.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every(x => x.length >= 4)) chunks = commaParts;
  }

  if (chunks.length === 1 && normalized.length > 70) {
    const clauses = normalized
      .split(/\s+e\s+(?=(?:non|si|fa|presenta|perde|vibra|frena|parte|abbiamo|ho|cambi|sostitu|controll|smont|mont|pul|regol))/i)
      .map(x => x.trim())
      .filter(Boolean);
    if (clauses.length > 1) chunks = clauses;
  }

  return chunks;
}

export function rewriteWorkshopNotes(value = '', context = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parts = splitRoughNotes(raw)
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
      for (const term of group.terms) if (!out.includes(term)) out.push(term);
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
  for (const [pattern, replacement] of DICTATION_NORMALIZATIONS) text = text.replace(pattern, replacement);
  return text;
}
