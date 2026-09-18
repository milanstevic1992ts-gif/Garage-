import { vehicles, jobs, photos, inventory, stockMovements } from './db.js';

const clean = value => String(value || '')
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, ' ')
  .slice(0, 90) || 'Senza nome';

export function customerName(vehicle) {
  return [vehicle.firstName, vehicle.lastName].filter(Boolean).join(' ').trim() || 'Cliente';
}

export function vehicleFolderName(vehicle) {
  return clean(`${vehicle.plate || 'SENZA-TARGA'} - ${customerName(vehicle)}`);
}

export function vehicleLabel(vehicle) {
  return [vehicle.brand, vehicle.model, vehicle.year ? `(${vehicle.year})` : ''].filter(Boolean).join(' ').trim();
}

function humanVehicle(vehicle) {
  return [
    'GARAGE — SCHEDA VEICOLO',
    '',
    `Targa: ${vehicle.plate || ''}`,
    `Cliente: ${customerName(vehicle)}`,
    `Telefono: ${vehicle.phone || ''}`,
    `Marca: ${vehicle.brand || ''}`,
    `Modello: ${vehicle.model || ''}`,
    `Anno: ${vehicle.year || ''}`,
    `Km attuali: ${vehicle.mileageKm || ''}`,
    `Stato: ${vehicle.status || ''}`,
    '',
    'PROBLEMI DICHIARATI DAL CLIENTE',
    vehicle.declaredProblems || '',
    '',
    'PROBLEMI RISCONTRATI IN OFFICINA',
    vehicle.foundProblems || '',
    '',
    `Ultimo aggiornamento: ${vehicle.updatedAt || ''}`,
  ].join('\n');
}

function humanJobs(list) {
  if (!list.length) return 'Nessun intervento registrato.\n';
  return [...list]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .map(item => [
      `DATA: ${item.date || ''}`,
      item.mileageKm ? `KM: ${item.mileageKm}` : '',
      `LAVORO: ${item.workDone || ''}`,
      item.customerNotes ? `NOTE CLIENTE: ${item.customerNotes}` : '',
      item.internalNotes ? `NOTA INTERNA: ${item.internalNotes}` : '',
      '----------------------------------------',
    ].filter(Boolean).join('\n'))
    .join('\n');
}

export function photoFileName(photo) {
  const date = new Date(photo.createdAt || Date.now());
  const stamp = Number.isNaN(date.getTime())
    ? String(photo.id)
    : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}_${clean(photo.id)}.jpg`;
}

export function photoPath(vehicle, photo) {
  const phase = clean(photo.phase || 'ingresso').toLowerCase();
  return `${vehicleFolderName(vehicle)}/foto/${phase}/${photoFileName(photo)}`;
}

export async function vehicleEntries(vehicleId, includePhotos = false) {
  const vehicle = await vehicles.get(vehicleId);
  if (!vehicle) return [];

  const vehicleJobs = await jobs.byVehicle(vehicleId);
  const vehiclePhotos = await photos.byVehicle(vehicleId);
  const root = vehicleFolderName(vehicle);

  const normalized = {
    ...vehicle,
    customerName: customerName(vehicle),
    label: vehicleLabel(vehicle),
    jobs: vehicleJobs.map(x => x.id),
    photos: vehiclePhotos.map(x => ({
      id: x.id,
      phase: x.phase,
      createdAt: x.createdAt,
      fileName: photoFileName(x),
    })),
  };

  const result = [
    {
      path: `${root}/scheda.json`,
      type: 'text',
      mime: 'application/json',
      data: JSON.stringify(normalized, null, 2),
    },
    {
      path: `${root}/scheda.txt`,
      type: 'text',
      mime: 'text/plain',
      data: humanVehicle(vehicle),
    },
    {
      path: `${root}/interventi.json`,
      type: 'text',
      mime: 'application/json',
      data: JSON.stringify(vehicleJobs, null, 2),
    },
    {
      path: `${root}/storico.txt`,
      type: 'text',
      mime: 'text/plain',
      data: humanJobs(vehicleJobs),
    },
  ];

  if (includePhotos) {
    for (const photo of vehiclePhotos) {
      result.push({
        path: photoPath(vehicle, photo),
        type: 'blob',
        mime: photo.blob?.type || 'image/jpeg',
        data: photo.blob,
      });
    }
  }

  return result;
}

export async function inventoryEntries() {
  const items = await inventory.all();
  const movements = await stockMovements.all();
  const text = items
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(item => {
      const location = [
        item.shelf ? `Scaffale ${item.shelf}` : '',
        item.level ? `Ripiano ${item.level}` : '',
        item.drawer ? `Cassetto ${item.drawer}` : '',
      ].filter(Boolean).join(' · ') || 'Posizione non assegnata';
      return [
        item.name,
        item.compatibleWith ? `Compatibile: ${item.compatibleWith}` : '',
        `Condizione: ${item.condition || 'buono'}`,
        `Quantità: ${item.quantity ?? 0}`,
        location,
        item.notes || '',
        '----------------------------------------',
      ].filter(Boolean).join('\n');
    }).join('\n');

  const movementText = [...movements]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(m => [
      m.createdAt ? new Date(m.createdAt).toLocaleString('it-IT') : '',
      m.itemName || m.itemId,
      `Tipo: ${m.type}`,
      `Variazione: ${m.delta > 0 ? '+' : ''}${m.delta}`,
      `Quantità dopo: ${m.quantityAfter}`,
      [m.shelf ? `Scaffale ${m.shelf}` : '', m.level ? `Ripiano ${m.level}` : '', m.drawer ? `Cassetto ${m.drawer}` : ''].filter(Boolean).join(' · '),
      '----------------------------------------',
    ].filter(Boolean).join('\n'))
    .join('\n');

  return [
    {
      path: '_magazzino/ricambi.json',
      type: 'text',
      mime: 'application/json',
      data: JSON.stringify(items, null, 2),
    },
    {
      path: '_magazzino/ricambi.txt',
      type: 'text',
      mime: 'text/plain',
      data: text || 'Nessun ricambio registrato.\n',
    },
    {
      path: '_magazzino/movimenti.json',
      type: 'text',
      mime: 'application/json',
      data: JSON.stringify(movements, null, 2),
    },
    {
      path: '_magazzino/movimenti.txt',
      type: 'text',
      mime: 'text/plain',
      data: movementText || 'Nessun movimento registrato.\n',
    },
  ];
}
