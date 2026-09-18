import { vehicles, photos, meta } from './db.js';
import { vehicleEntries, photoPath, inventoryEntries } from './archive.js';
import * as destinations from './destinations.js';

const pending = new Map();

function anyOk(result) {
  return Object.values(result || {}).some(x => x?.ok);
}

async function writeEntry(entry) {
  return destinations.writeConfigured(async slot => {
    const fullPath = `Garage/${entry.path}`;
    if (entry.type === 'text') {
      await destinations.writeText(slot, fullPath, entry.data, entry.mime);
    } else {
      await destinations.writeBlob(slot, fullPath, entry.data, entry.mime);
    }
  });
}

export async function syncVehicle(vehicleId) {
  if (!destinations.available()) return false;
  let wrote = false;
  for (const entry of await vehicleEntries(vehicleId, false)) {
    wrote = anyOk(await writeEntry(entry)) || wrote;
  }
  if (wrote) await meta.set('lastBackupAt', new Date().toISOString());
  return wrote;
}

export function scheduleVehicle(vehicleId, delay = 800) {
  if (!vehicleId) return;
  clearTimeout(pending.get(vehicleId));
  pending.set(vehicleId, setTimeout(() => {
    pending.delete(vehicleId);
    syncVehicle(vehicleId).catch(() => {});
  }, delay));
}

export async function syncPhoto(photo) {
  if (!destinations.available()) return false;
  const vehicle = await vehicles.get(photo.vehicleId);
  if (!vehicle) return false;

  const result = await destinations.writeConfigured(async slot => {
    if (slot === 'local' && photo.backupLocal) return;
    if (slot === 'drive' && photo.backupDrive) return;
    await destinations.writeBlob(
      slot,
      `Garage/${photoPath(vehicle, photo)}`,
      photo.blob,
      photo.blob?.type || 'image/jpeg',
    );
  });

  if (result.local?.ok) photo.backupLocal = true;
  if (result.drive?.ok) photo.backupDrive = true;
  await photos.save(photo);

  if (anyOk(result)) {
    await meta.set('lastBackupAt', new Date().toISOString());
    scheduleVehicle(photo.vehicleId, 200);
    return true;
  }
  return false;
}

export async function syncInventory() {
  if (!destinations.available()) return false;
  let wrote = false;
  for (const entry of await inventoryEntries()) {
    wrote = anyOk(await writeEntry(entry)) || wrote;
  }
  if (wrote) await meta.set('lastBackupAt', new Date().toISOString());
  return wrote;
}

export async function resetSlot(slot) {
  const field = slot === 'local' ? 'backupLocal' : 'backupDrive';
  for (const photo of await photos.all()) {
    photo[field] = false;
    await photos.save(photo);
  }
}

export async function retryPendingPhotos() {
  if (!destinations.available()) return false;
  const s = await destinations.status();
  let wrote = false;

  for (const photo of await photos.all()) {
    const needLocal = s.local?.configured && !photo.backupLocal;
    const needDrive = s.drive?.configured && !photo.backupDrive;
    if (!needLocal && !needDrive) continue;
    try {
      wrote = (await syncPhoto(photo)) || wrote;
    } catch (_) {}
  }
  return wrote;
}

export async function syncAll() {
  let wrote = false;
  for (const vehicle of await vehicles.all()) {
    try { wrote = (await syncVehicle(vehicle.id)) || wrote; } catch (_) {}
  }
  for (const photo of await photos.all()) {
    try { wrote = (await syncPhoto(photo)) || wrote; } catch (_) {}
  }
  try { wrote = (await syncInventory()) || wrote; } catch (_) {}
  return wrote;
}
