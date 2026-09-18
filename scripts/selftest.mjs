import {
  smartInventorySearch,
  suggestInventoryLocations,
  parseShelfCode,
} from '../www/js/search-ai.js';
import {
  orderRoughNotes,
  suggestInventoryTerms,
  normalizeWorkshopDictation,
} from '../www/js/notes-ai.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const items = [
  {
    id:'1',
    name:'Carburatore Dellorto',
    category:'Alimentazione',
    brand:'Dellorto',
    compatibleWith:'Peugeot Betwin 50',
    quantity:1,
    shelf:'C',
    level:'2',
    condition:'ottimo',
    updatedAt:'2026-09-18',
  },
  {
    id:'2',
    name:'Centralina CDI',
    category:'Elettrico',
    brand:'Ducati Energia',
    compatibleWith:'Piaggio Liberty 50',
    quantity:1,
    shelf:'A',
    level:'1',
    condition:'buono',
    updatedAt:'2026-09-18',
  },
];

assert(
  smartInventorySearch(items, 'carburatre betwin')[0]?.id === '1',
  'Ricerca fuzzy magazzino fallita',
);
assert(
  smartInventorySearch(items, 'carb betwin verde scaffale C ripiano 2')[0]?.id === '1',
  'Ricerca combinata magazzino fallita',
);

const qr = parseShelfCode('GARAGE:SCAFFALE:B:RIPIANO:4');
assert(qr?.shelf === 'B' && qr?.level === '4', 'Parsing QR scaffale fallito');

const suggestions = suggestInventoryLocations(items, {
  name:'Carburatore',
  category:'Alimentazione',
  brand:'Dellorto',
  compatibleWith:'Peugeot Betwin 50',
});
assert(suggestions[0]?.shelf === 'C', 'Suggerimento scaffale fallito');

const ordered = orderRoughNotes('non parte a freddo; scintilla debole controllare bobina');
assert(ordered.includes('Non parte a freddo.'), 'Riordino appunti fallito');

const terms = suggestInventoryTerms('non parte a freddo e scintilla debole');
assert(terms.includes('bobina') && terms.includes('candela'), 'Suggerimenti ricambi falliti');

const voice = normalizeWorkshopDictation('t max cd i dell orto bet win');
assert(
  voice.includes('TMAX') && voice.includes('CDI') && voice.includes("Dell'Orto") && voice.includes('Betwin'),
  'Normalizzazione dettatura fallita',
);

console.log('Garage self-test: OK');
