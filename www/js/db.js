const DB_NAME = 'garage';
const DB_VERSION = 2;
let cached = null;

function openDb() {
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('vehicles')) {
        const s = db.createObjectStore('vehicles', { keyPath: 'id' });
        s.createIndex('normalizedPlate', 'normalizedPlate', { unique: true });
        s.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('jobs')) {
        const s = db.createObjectStore('jobs', { keyPath: 'id' });
        s.createIndex('vehicleId', 'vehicleId');
        s.createIndex('date', 'date');
      }

      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('vehicleId', 'vehicleId');
        s.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('inventory')) {
        const s = db.createObjectStore('inventory', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('stockMovements')) {
        const s = db.createObjectStore('stockMovements', { keyPath: 'id' });
        s.createIndex('itemId', 'itemId');
        s.createIndex('createdAt', 'createdAt');
        s.createIndex('type', 'type');
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      cached = request.result;
      resolve(cached);
    };
    request.onerror = () => reject(request.error);
  });
}

function run(storeName, mode, executor) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request = null;

    try {
      request = executor(store);
    } catch (error) {
      reject(error);
      return;
    }

    tx.onerror = () => reject(tx.error);
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve();
    }
  }));
}

function byIndex(storeName, indexName, value) {
  return run(storeName, 'readonly', s => s.index(indexName).getAll(value));
}

export const vehicles = {
  all: () => run('vehicles', 'readonly', s => s.getAll()),
  get: id => run('vehicles', 'readonly', s => s.get(id)),
  getByPlate: async normalizedPlate => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vehicles', 'readonly');
      const req = tx.objectStore('vehicles').index('normalizedPlate').get(normalizedPlate);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  save: item => run('vehicles', 'readwrite', s => s.put(item)),
  remove: id => run('vehicles', 'readwrite', s => s.delete(id)),
};

export const jobs = {
  all: () => run('jobs', 'readonly', s => s.getAll()),
  get: id => run('jobs', 'readonly', s => s.get(id)),
  byVehicle: vehicleId => byIndex('jobs', 'vehicleId', vehicleId),
  save: item => run('jobs', 'readwrite', s => s.put(item)),
  remove: id => run('jobs', 'readwrite', s => s.delete(id)),
};

export const photos = {
  all: () => run('photos', 'readonly', s => s.getAll()),
  get: id => run('photos', 'readonly', s => s.get(id)),
  byVehicle: vehicleId => byIndex('photos', 'vehicleId', vehicleId),
  save: item => run('photos', 'readwrite', s => s.put(item)),
  remove: id => run('photos', 'readwrite', s => s.delete(id)),
};

export const inventory = {
  all: () => run('inventory', 'readonly', s => s.getAll()),
  get: id => run('inventory', 'readonly', s => s.get(id)),
  save: item => run('inventory', 'readwrite', s => s.put(item)),
  remove: id => run('inventory', 'readwrite', s => s.delete(id)),
};

export const stockMovements = {
  all: () => run('stockMovements', 'readonly', s => s.getAll()),
  byItem: itemId => byIndex('stockMovements', 'itemId', itemId),
  save: item => run('stockMovements', 'readwrite', s => s.put(item)),
};

export const meta = {
  get: async key => (await run('meta', 'readonly', s => s.get(key)))?.value ?? null,
  set: (key, value) => run('meta', 'readwrite', s => s.put({ key, value })),
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizePlate(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}
