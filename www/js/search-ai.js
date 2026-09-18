/*
  Garage Mini AI v1
  Motore di ricerca locale, deterministico e offline.
  Non è un LLM generativo: usa sinonimi da officina, fuzzy matching,
  pesi per campo e comprensione di posizione/condizione.
*/

const SYNONYM_GROUPS = [
  ['carburatore','carburatori','carb','carburazione'],
  ['centralina','cdi','ecu','elettronica'],
  ['marmitta','scarico','terminale'],
  ['gomma','gomme','pneumatico','pneumatici','copertone'],
  ['faro','fanale','luce'],
  ['freccia','frecce','indicatore','indicatori'],
  ['batteria','accumulatore'],
  ['motorino','starter','avviamento'],
  ['pompa','pompa-benzina','pompa-carburante'],
  ['benzina','carburante'],
  ['filtro','filtri'],
  ['filtro-aria','aria','airbox'],
  ['filtro-olio','olio'],
  ['cinghia','cinghie','trasmissione'],
  ['variatore','variatori'],
  ['rullo','rulli','massette'],
  ['frizione','frizioni'],
  ['campana','campane'],
  ['statore','alternatore'],
  ['regolatore','raddrizzatore'],
  ['bobina','bobine'],
  ['candela','candele'],
  ['iniettore','iniettori','iniezione'],
  ['collettore','collettori'],
  ['radiatore','raffreddamento'],
  ['leva','leve'],
  ['freno','freni'],
  ['pastiglia','pastiglie'],
  ['disco','dischi'],
  ['pinza','pinze'],
  ['ammortizzatore','ammortizzatori'],
  ['forcella','forcelle'],
  ['cerchio','cerchi','ruota','ruote'],
  ['sella','sedile'],
  ['carena','carene','scocca'],
  ['quadro','strumentazione','contachilometri'],
  ['specchio','specchietto','specchietti'],
  ['nuovo','nuova'],
  ['usato','usata'],
];

const CONDITION_ALIASES = {
  rosso: 'discreto',
  rossa: 'discreto',
  discreto: 'discreto',
  discreta: 'discreto',
  giallo: 'buono',
  gialla: 'buono',
  buono: 'buono',
  buona: 'buono',
  verde: 'ottimo',
  ottimo: 'ottimo',
  ottima: 'ottimo',
};

const STOP_WORDS = new Set([
  'mi','serve','servono','cerco','cerca','trova','trovami','dove','sta','stanno',
  'un','uno','una','il','lo','la','i','gli','le','per','del','della','dello',
  'dei','delle','di','da','in','con','che','pezzo','pezzi','ricambio','ricambi',
]);

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9.+-]+/g, ' ')
    .trim();
}

function rawTokens(value) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  const normalized = group.map(normalize);
  for (const token of normalized) SYNONYMS.set(token, normalized);
}

function variants(token) {
  const base = normalize(token);
  const group = SYNONYMS.get(base);
  return group ? [...new Set([base, ...group])] : [base];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function tokenSimilarity(query, candidate) {
  query = normalize(query);
  candidate = normalize(candidate);
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;

  // Codici corti (es. Scaffale C, Ripiano 2) devono combaciare solo esattamente.
  // Evita falsi positivi come "carb" che contiene la lettera di uno scaffale.
  if (query.length <= 2 || candidate.length <= 2) return 0;

  if (candidate.includes(query) || query.includes(candidate)) {
    const ratio = Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length);
    return 0.82 + ratio * 0.16;
  }

  const distance = levenshtein(query, candidate);
  const similarity = 1 - distance / Math.max(query.length, candidate.length);

  // Tollera 1 errore su parole corte e 2 circa su parole più lunghe.
  const floor = Math.max(query.length, candidate.length) <= 5 ? 0.72 : 0.64;
  return similarity >= floor ? similarity * 0.78 : 0;
}

function textMatchScore(queryToken, text) {
  const words = rawTokens(text);
  if (!words.length) return 0;

  let best = 0;
  for (const qv of variants(queryToken)) {
    for (const word of words) {
      best = Math.max(best, tokenSimilarity(qv, word));
      if (best >= 1) return 1;
    }
  }
  return best;
}

function parseLocation(query) {
  const text = normalize(query);
  const shelf = text.match(/(?:scaffale|scaf|shelf)\s*([a-z0-9]+)/i)?.[1] || '';
  const level = text.match(/(?:ripiano|rip|piano|level)\s*([a-z0-9]+)/i)?.[1] || '';
  const drawer = text.match(/(?:cassetto|cass|drawer)\s*([a-z0-9]+)/i)?.[1] || '';
  return { shelf, level, drawer };
}

function parseCondition(tokens) {
  for (const token of tokens) {
    if (CONDITION_ALIASES[token]) return CONDITION_ALIASES[token];
  }
  return '';
}

function queryTokens(query) {
  return rawTokens(query).filter(token =>
    !STOP_WORDS.has(token) &&
    !['scaffale','scaf','shelf','ripiano','rip','piano','level','cassetto','cass','drawer'].includes(token) &&
    !CONDITION_ALIASES[token]
  );
}

function weightedBest(token, fields) {
  let best = 0;
  for (const [value, weight] of fields) {
    const score = textMatchScore(token, value);
    best = Math.max(best, score * weight);
  }
  return best;
}

export function interpretInventoryQuery(query) {
  const raw = rawTokens(query);
  const condition = parseCondition(raw);
  const location = parseLocation(query);
  return {
    tokens: queryTokens(query),
    condition,
    location,
  };
}

export function smartInventorySearch(items, query) {
  const q = normalize(query);
  if (!q) return [...items];

  const parsed = interpretInventoryQuery(query);

  return items
    .map(item => {
      const fields = [
        [item.name, 12],
        [item.partNumber, 11],
        [item.compatibleWith, 10],
        [item.brand, 7],
        [item.category, 6],
        [item.shelf, 6],
        [item.level, 6],
        [item.drawer, 5],
        [item.condition, 5],
        [item.notes, 2],
      ];

      let score = 0;
      let matchedTokens = 0;

      for (const token of parsed.tokens) {
        const best = weightedBest(token, fields);
        if (best >= 4.3) matchedTokens++;
        score += best;
      }

      // Con più parole richiediamo che quasi tutte abbiano senso.
      const required = parsed.tokens.length <= 2
        ? parsed.tokens.length
        : Math.max(2, parsed.tokens.length - 1);

      if (matchedTokens < required) return { item, score: -1 };

      if (parsed.condition) {
        if (normalize(item.condition) !== parsed.condition) return { item, score: -1 };
        score += 12;
      }

      const { shelf, level, drawer } = parsed.location;
      if (shelf) {
        if (normalize(item.shelf) !== normalize(shelf)) return { item, score: -1 };
        score += 10;
      }
      if (level) {
        if (normalize(item.level) !== normalize(level)) return { item, score: -1 };
        score += 10;
      }
      if (drawer) {
        if (normalize(item.drawer) !== normalize(drawer)) return { item, score: -1 };
        score += 8;
      }

      // Bonus per frase completa presente in nome/compatibilità/codice.
      for (const value of [item.name, item.compatibleWith, item.partNumber]) {
        const normalized = normalize(value);
        if (normalized && normalized.includes(q)) score += 15;
      }

      return { item, score };
    })
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
    .map(x => x.item);
}

export function smartVehicleSearch(items, query) {
  const q = normalize(query);
  if (!q) return [...items];

  const tokens = rawTokens(query).filter(token => !STOP_WORDS.has(token));

  return items
    .map(item => {
      const fields = [
        [item.plate, 14],
        [item.normalizedPlate, 14],
        [item.phone, 12],
        [item.firstName, 9],
        [item.lastName, 9],
        [[item.firstName, item.lastName].filter(Boolean).join(' '), 11],
        [item.brand, 7],
        [item.model, 8],
        [item.declaredProblems, 3],
        [item.foundProblems, 4],
      ];

      let score = 0;
      let matched = 0;
      for (const token of tokens) {
        const best = weightedBest(token, fields);
        if (best >= 4.5) matched++;
        score += best;
      }

      if (matched < tokens.length) return { item, score: -1 };

      for (const value of [item.plate, item.phone, item.firstName, item.lastName, item.model]) {
        if (normalize(value).includes(q)) score += 14;
      }

      return { item, score };
    })
    .filter(x => x.score >= 0)
    .sort((a,b) => b.score - a.score || String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
    .map(x => x.item);
}

export function inventoryQueryHint(query) {
  const parsed = interpretInventoryQuery(query);
  const parts = [];
  if (parsed.condition) {
    const label = { discreto:'Discreto', buono:'Buono', ottimo:'Ottimo' }[parsed.condition];
    parts.push(`condizione ${label}`);
  }
  if (parsed.location.shelf) parts.push(`Scaffale ${parsed.location.shelf.toUpperCase()}`);
  if (parsed.location.level) parts.push(`Ripiano ${parsed.location.level}`);
  if (parsed.location.drawer) parts.push(`Cassetto ${parsed.location.drawer}`);
  return parts.join(' · ');
}


export function parseShelfCode(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.toUpperCase().replace(/\s+/g, ' ').trim();

  // Formati consigliati:
  // GARAGE:SCAFFALE:B
  // GARAGE:SCAFFALE:B:RIPIANO:2
  // SCAFFALE B
  // B
  let match = normalized.match(/^GARAGE[:| -]+SCAFFALE[:| -]+([A-Z0-9]+)(?:[:| -]+RIPIANO[:| -]+([A-Z0-9]+))?(?:[:| -]+CASSETTO[:| -]+([A-Z0-9]+))?$/);
  if (!match) {
    match = normalized.match(/^SCAFFALE\s*[: -]?\s*([A-Z0-9]+)(?:\s+RIPIANO\s*[: -]?\s*([A-Z0-9]+))?(?:\s+CASSETTO\s*[: -]?\s*([A-Z0-9]+))?$/);
  }
  if (!match && /^[A-Z0-9]{1,4}$/.test(normalized)) {
    match = [normalized, normalized, '', ''];
  }
  if (!match) return null;

  return {
    shelf: match[1] || '',
    level: match[2] || '',
    drawer: match[3] || '',
  };
}

function exactSame(a, b) {
  return normalize(a) && normalize(a) === normalize(b);
}

export function suggestInventoryLocations(items, draft, limit = 3) {
  const groups = new Map();

  for (const item of items) {
    if (!item.shelf || Number(item.quantity || 0) <= 0) continue;
    if (draft.id && item.id === draft.id) continue;

    let score = 0;
    const reasons = [];

    if (exactSame(item.category, draft.category)) {
      score += 8;
      reasons.push('stessa categoria');
    }
    if (exactSame(item.brand, draft.brand)) {
      score += 5;
      reasons.push('stessa marca');
    }
    if (exactSame(item.compatibleWith, draft.compatibleWith)) {
      score += 9;
      reasons.push('stessa compatibilità');
    }

    const nameTokens = rawTokens(draft.name);
    for (const token of nameTokens) {
      const s = textMatchScore(token, item.name);
      if (s > 0.78) {
        score += 5;
        reasons.push('pezzo simile');
        break;
      }
    }

    if (score <= 0) continue;

    const key = [
      normalize(item.shelf),
      normalize(item.level),
      normalize(item.drawer),
    ].join('|');

    const current = groups.get(key) || {
      shelf: item.shelf,
      level: item.level || '',
      drawer: item.drawer || '',
      score: 0,
      count: 0,
      reasons: new Set(),
    };

    current.score += score;
    current.count += 1;
    for (const reason of reasons) current.reasons.add(reason);
    groups.set(key, current);
  }

  return [...groups.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit)
    .map(x => ({
      shelf: x.shelf,
      level: x.level,
      drawer: x.drawer,
      score: x.score,
      reason: [...x.reasons].slice(0, 2).join(' · '),
    }));
}
