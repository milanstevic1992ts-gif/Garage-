let active = false;
let latestText = '';
let segmentText = '';
let completedSegments = [];
let handles = [];
let keepListening = false;
let restartTimer = null;
let currentOptions = null;
let currentCallbacks = {};

const CONTEXT = [
  'Garage','scooter','moto','carburatore','centralina CDI','statore','bobina',
  'candela','variatore','cinghia','frizione','campana','iniettore','radiatore',
  'pastiglie','pinza freno','disco freno','ammortizzatore','forcella',
  'scaffale','ripiano','chilometri','Betwin','TMAX','Liberty','Aerox'
];

function plugin() {
  return window.Capacitor?.Plugins?.SpeechRecognition || null;
}

function normalized(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function combinedText() {
  return [...completedSegments, segmentText]
    .map(normalized)
    .filter(Boolean)
    .filter((value,index,array) => index === 0 || value !== array[index - 1])
    .join(' ')
    .trim();
}

function commitSegment() {
  const value = normalized(segmentText);
  if (value && completedSegments.at(-1) !== value) completedSegments.push(value);
  segmentText = '';
  latestText = combinedText();
}

async function clearListeners() {
  for (const handle of handles.splice(0)) {
    try { await handle.remove(); } catch (_) {}
  }
}

function clearRestartTimer() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
}

async function startNativeRecognition() {
  const p = plugin();
  if (!p || !keepListening || !currentOptions) return;
  try {
    await p.start(currentOptions);
    active = true;
    currentCallbacks.onState?.('started');
  } catch (error) {
    active = false;
    if (keepListening) {
      restartTimer = setTimeout(() => startNativeRecognition(), 650);
    } else {
      currentCallbacks.onError?.(error?.message || 'Errore riconoscimento vocale');
    }
  }
}

export function isSpeechAvailable() {
  return !!window.Capacitor?.isNativePlatform?.() && !!plugin();
}

export function isListening() {
  return keepListening;
}

export async function startDictation({ onPartial, onState, onError } = {}) {
  const p = plugin();
  if (!p) throw new Error('Dettatura disponibile nell’APK Android.');

  clearRestartTimer();
  await clearListeners();
  latestText = '';
  segmentText = '';
  completedSegments = [];
  currentCallbacks = { onPartial, onState, onError };

  const permission = await p.requestPermissions();
  if (permission?.speechRecognition !== 'granted') {
    throw new Error('Permesso microfono non concesso.');
  }

  const availability = await p.available();
  if (!availability?.available) {
    throw new Error('Riconoscimento vocale non disponibile su questo telefono.');
  }

  handles.push(await p.addListener('partialResults', event => {
    segmentText = normalized(event?.accumulatedText || event?.matches?.[0] || event?.accumulated || '');
    latestText = combinedText();
    onPartial?.(latestText);
  }));

  try {
    handles.push(await p.addListener('segmentResults', event => {
      const value = normalized(event?.matches?.[0] || '');
      if (value) {
        segmentText = value;
        commitSegment();
        onPartial?.(latestText);
      }
    }));
  } catch (_) {}

  handles.push(await p.addListener('listeningState', event => {
    const speechState = event?.status || event?.state || '';
    if (speechState === 'started' || speechState === 'startingListening') {
      active = true;
      onState?.('started');
      return;
    }

    if (speechState === 'stopped') {
      active = false;
      commitSegment();
      if (keepListening) {
        onState?.('restarting');
        clearRestartTimer();
        restartTimer = setTimeout(() => startNativeRecognition(), 450);
      } else {
        onState?.('stopped');
      }
    }
  }));

  try {
    handles.push(await p.addListener('error', event => {
      active = false;
      const message = event?.message || event?.code || 'Errore riconoscimento vocale';
      if (keepListening && /no match|speech timeout|timeout/i.test(message)) {
        commitSegment();
        clearRestartTimer();
        restartTimer = setTimeout(() => startNativeRecognition(), 550);
        return;
      }
      onError?.(message);
    }));
  } catch (_) {}

  currentOptions = {
    language: 'it-IT',
    maxResults: 1,
    popup: false,
    partialResults: true,
    allowForSilence: 10000,
    addPunctuation: true,
    contextualStrings: CONTEXT,
  };

  keepListening = true;
  active = true;
  onState?.('startingListening');
  await startNativeRecognition();
  return true;
}

export async function stopDictation() {
  const p = plugin();
  keepListening = false;
  clearRestartTimer();
  if (!p) return combinedText();

  try { await p.stop(); } catch (_) {}
  commitSegment();
  latestText = combinedText();
  active = false;
  await clearListeners();
  currentOptions = null;
  return latestText;
}

export async function cancelDictation() {
  const p = plugin();
  keepListening = false;
  clearRestartTimer();
  try { await p?.stop?.(); } catch (_) {}
  active = false;
  latestText = '';
  segmentText = '';
  completedSegments = [];
  currentOptions = null;
  await clearListeners();
}
