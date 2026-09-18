export const native = !!window.Capacitor?.isNativePlatform?.();

function plugin() {
  return window.Capacitor?.Plugins?.GarageStorage || null;
}

export function available() {
  return native && !!plugin();
}

export async function choose(slot) {
  if (!['local', 'drive'].includes(slot)) throw new Error('Destinazione non valida.');
  const p = plugin();
  if (!p) throw new Error('Questa funzione è disponibile nell’APK Android.');
  return p.pickTree({ slot });
}

export async function status() {
  const p = plugin();
  if (!p) {
    return {
      local: { configured: false, label: '' },
      drive: { configured: false, label: '' },
    };
  }
  return p.getTargets();
}

export async function writeText(slot, path, text, mime = 'text/plain') {
  const p = plugin();
  if (!p) return false;
  await p.writeText({ slot, path, text, mime });
  return true;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

export async function writeBlob(slot, path, blob, mime = 'application/octet-stream') {
  const p = plugin();
  if (!p) return false;
  const base64 = await blobToBase64(blob);
  await p.writeBase64({ slot, path, base64, mime });
  return true;
}

export async function writeConfigured(writer) {
  const s = await status();
  const result = {};
  for (const slot of ['local', 'drive']) {
    if (!s[slot]?.configured) {
      result[slot] = { ok: false, skipped: true };
      continue;
    }
    try {
      await writer(slot);
      result[slot] = { ok: true };
    } catch (error) {
      result[slot] = { ok: false, error: error.message };
    }
  }
  return result;
}
