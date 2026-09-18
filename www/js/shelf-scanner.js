import { parseShelfCode } from './search-ai.js';

export function scannerAvailable() {
  return !!window.Capacitor?.isNativePlatform?.()
    && !!window.Capacitor?.Plugins?.CapacitorBarcodeScanner;
}

export async function scanShelf() {
  const scanner = window.Capacitor?.Plugins?.CapacitorBarcodeScanner;
  if (!scanner) throw new Error('Scanner scaffale disponibile nell’APK Android.');

  const result = await scanner.scanBarcode({
    hint: 0,
    scanInstructions: 'Inquadra il QR dello scaffale',
    scanButton: false,
    cameraDirection: 1,
    scanOrientation: 3,
    android: { scanningLibrary: 'mlkit' },
  });

  const parsed = parseShelfCode(result?.ScanResult || '');
  if (!parsed) throw new Error('QR scaffale non riconosciuto.');
  return parsed;
}
