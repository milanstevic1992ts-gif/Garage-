let active = false;
let latestText = '';
let handles = [];

const CONTEXT = [
  'Garage','scooter','moto','carburatore','centralina CDI','statore','bobina',
  'candela','variatore','cinghia','frizione','campana','iniettore','radiatore',
  'pastiglie','pinza freno','disco freno','ammortizzatore','forcella',
  'scaffale','ripiano','chilometri','Betwin','TMAX','Liberty','Aerox'
];

function plugin() {
  return window.Capacitor?.Plugins?.SpeechRecognition || null;
}

async function clearListeners() {
  for (const handle of handles.splice(0)) {
    try { await handle.remove(); } catch (_) {}
  }
}

export function isSpeechAvailable() {
  return !!window.Capacitor?.isNativePlatform?.() && !!plugin();
}

export function isListening() {
  return active;
}

export async function startDictation({ onPartial, onState, onError } = {}) {
  const p = plugin();
  if (!p) throw new Error('Dettatura disponibile nell’APK Android.');

  await clearListeners();
  latestText = '';

  const permission = await p.requestPermissions();
  if (permission?.speechRecognition !== 'granted') {
    throw new Error('Permesso microfono non concesso.');
  }

  const availability = await p.available();
  if (!availability?.available) {
    throw new Error('Riconoscimento vocale non disponibile su questo telefono.');
  }

  let useOnDeviceRecognition = false;
  try {
    const local = await p.isOnDeviceRecognitionAvailable();
    useOnDeviceRecognition = !!local?.available;
  } catch (_) {}

  handles.push(await p.addListener('partialResults', event => {
    latestText = (
      event?.accumulatedText ||
      event?.matches?.[0] ||
      event?.accumulated ||
      ''
    ).trim();
    onPartial?.(latestText);
  }));

  handles.push(await p.addListener('listeningState', event => {
    active = event?.state === 'started' || event?.state === 'startingListening';
    onState?.(event?.state || (active ? 'started' : 'stopped'));
  }));

  handles.push(await p.addListener('error', event => {
    active = false;
    onError?.(event?.message || event?.code || 'Errore riconoscimento vocale');
  }));

  active = true;
  onState?.('startingListening');

  await p.start({
    language: 'it-IT',
    maxResults: 1,
    popup: false,
    partialResults: true,
    addPunctuation: true,
    contextualStrings: CONTEXT,
    useOnDeviceRecognition,
  });

  return true;
}

export async function stopDictation() {
  const p = plugin();
  if (!p) return latestText;

  try {
    if (p.forceStop) await p.forceStop({ timeout: 1200 });
    else await p.stop();
  } catch (_) {
    try { await p.stop(); } catch (_) {}
  }

  try {
    const last = await p.getLastPartialResult();
    latestText = (last?.text || last?.matches?.[0] || latestText || '').trim();
  } catch (_) {}

  active = false;
  await clearListeners();
  return latestText;
}

export async function cancelDictation() {
  const p = plugin();
  try { await p?.forceStop?.({ timeout: 700 }); } catch (_) {}
  active = false;
  latestText = '';
  await clearListeners();
}
