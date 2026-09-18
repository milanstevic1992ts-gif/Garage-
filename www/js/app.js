import {
  vehicles, jobs, photos, inventory, meta,
  uuid, nowIso, normalizePlate,
} from './db.js';
import { customerName, vehicleLabel } from './archive.js';
import * as backup from './backup.js';
import * as destinations from './destinations.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;',
})[c]);

const state = {
  view: 'home',
  vehicles: [],
  inventory: [],
  activeVehicleId: null,
  photoVehicleId: null,
};

const STATUS = {
  da_controllare: 'Da controllare',
  in_lavorazione: 'In lavorazione',
  attesa_ricambi: 'Attesa ricambi',
  pronto: 'Pronto',
  consegnato: 'Consegnato',
};

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function showView(name) {
  state.view = name;
  $('#homeView').classList.toggle('hidden', name !== 'home');
  $('#vehicleView').classList.toggle('hidden', name !== 'vehicle');
  $('#inventoryView').classList.toggle('hidden', name !== 'inventory');
  $('#backupView').classList.toggle('hidden', name !== 'backup');

  $$('.bottom-nav button').forEach(button => {
    button.classList.toggle('active', button.dataset.view === name);
  });

  if (name === 'inventory') renderInventory();
  if (name === 'backup') renderBackup();
}

async function refreshVehicles() {
  state.vehicles = await vehicles.all();
  state.vehicles.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function vehicleCard(vehicle) {
  return `
    <button class="vehicle-card" data-vehicle-id="${vehicle.id}">
      <div class="card-top">
        <span class="plate">${esc(vehicle.plate)}</span>
        <span class="status ${esc(vehicle.status)}">${esc(STATUS[vehicle.status] || 'Da controllare')}</span>
      </div>
      <h3>${esc(customerName(vehicle))}</h3>
      <p>${esc(vehicleLabel(vehicle) || 'Marca/modello non indicati')}${vehicle.mileageKm ? ` · ${Number(vehicle.mileageKm).toLocaleString('it-IT')} km` : ''}</p>
    </button>
  `;
}

function renderVehicleList() {
  const q = $('#vehicleSearch').value.trim().toLowerCase();
  const normalized = normalizePlate(q);

  const list = state.vehicles.filter(v => {
    if (!q) return true;
    const values = [
      v.plate, v.normalizedPlate, v.firstName, v.lastName, customerName(v),
      v.phone, v.brand, v.model,
    ].filter(Boolean).map(x => String(x).toLowerCase());
    return values.some(x => x.includes(q)) || (normalized && v.normalizedPlate.includes(normalized));
  });

  $('#vehicleResults').innerHTML = list.length
    ? list.map(vehicleCard).join('')
    : '<div class="info-card"><strong>Nessun mezzo trovato</strong><p>Prova con targa, nome o telefono.</p></div>';

  $$('[data-vehicle-id]').forEach(button => {
    button.onclick = () => openVehicle(button.dataset.vehicleId);
  });
}

async function openVehicle(id) {
  state.activeVehicleId = id;
  showView('vehicle');
  await renderVehicleDetail();
}

async function renderVehicleDetail() {
  const vehicle = await vehicles.get(state.activeVehicleId);
  if (!vehicle) {
    showView('home');
    return;
  }

  const vehicleJobs = (await jobs.byVehicle(vehicle.id))
    .sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const vehiclePhotos = (await photos.byVehicle(vehicle.id))
    .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const tel = String(vehicle.phone || '').replace(/\s/g,'');

  $('#vehicleView').innerHTML = `
    <div class="detail-head">
      <button class="back-btn" id="backHome">‹ Garage</button>
      <button class="secondary" id="editVehicleButton">Modifica</button>
    </div>

    <div class="vehicle-card">
      <div class="card-top">
        <span class="plate">${esc(vehicle.plate)}</span>
        <span class="status ${esc(vehicle.status)}">${esc(STATUS[vehicle.status] || 'Da controllare')}</span>
      </div>
      <h2 style="margin:14px 0 4px">${esc(customerName(vehicle))}</h2>
      <p>${esc(vehicleLabel(vehicle) || 'Marca/modello non indicati')}${vehicle.mileageKm ? ` · ${Number(vehicle.mileageKm).toLocaleString('it-IT')} km` : ''}</p>
      <div class="quick-actions">
        ${tel ? `<a href="tel:${esc(tel)}">☎<br>Chiama</a>` : '<button disabled>☎<br>Telefono</button>'}
        <button id="addJobButton">🔧<br>Intervento</button>
        <button id="addPhotoButton">📷<br>Foto</button>
      </div>
    </div>

    <div class="problem-grid">
      <div class="problem-card">
        <small>PROBLEMI DICHIARATI</small>
        <p>${esc(vehicle.declaredProblems || '—')}</p>
      </div>
      <div class="problem-card">
        <small>PROBLEMI RISCONTRATI</small>
        <p>${esc(vehicle.foundProblems || '—')}</p>
      </div>
    </div>

    <div class="section-title"><strong>Fotografie</strong><span>${vehiclePhotos.length}</span></div>
    <div class="gallery" id="vehicleGallery">
      ${vehiclePhotos.length ? vehiclePhotos.map(photo => `
        <img data-photo-id="${photo.id}" alt="${esc(photo.phase || 'foto')}" src="${URL.createObjectURL(photo.blob)}">
      `).join('') : '<div class="info-card"><p>Nessuna foto ancora.</p></div>'}
    </div>

    <div class="section-title"><strong>Interventi</strong><span>${vehicleJobs.length}</span></div>
    <div class="stack">
      ${vehicleJobs.length ? vehicleJobs.map(job => `
        <article class="job-card">
          <div class="card-top">
            <strong>${esc(job.date)}</strong>
            <small>${job.mileageKm ? esc(job.mileageKm) + ' km' : ''}</small>
          </div>
          <p style="margin:9px 0 0">${esc(job.workDone)}</p>
          ${job.customerNotes ? `<p class="muted">${esc(job.customerNotes)}</p>` : ''}
        </article>
      `).join('') : '<div class="info-card"><p>Nessun intervento registrato.</p></div>'}
    </div>
  `;

  $('#backHome').onclick = () => showView('home');
  $('#editVehicleButton').onclick = () => openVehicleForm(vehicle);
  $('#addJobButton').onclick = () => openJobForm(vehicle);
  $('#addPhotoButton').onclick = () => {
    state.photoVehicleId = vehicle.id;
    $('#photoDialog').showModal();
  };
}

function openVehicleForm(vehicle = null) {
  const form = $('#vehicleForm');
  form.reset();
  $('#vehicleFormError').textContent = '';
  $('#vehicleFormTitle').textContent = vehicle ? 'Modifica scheda' : 'Nuovo ingresso';

  form.elements.id.value = vehicle?.id || '';
  form.elements.plate.value = vehicle?.plate || '';
  form.elements.firstName.value = vehicle?.firstName || '';
  form.elements.lastName.value = vehicle?.lastName || '';
  form.elements.phone.value = vehicle?.phone || '';
  form.elements.mileageKm.value = vehicle?.mileageKm || '';
  form.elements.brand.value = vehicle?.brand || '';
  form.elements.model.value = vehicle?.model || '';
  form.elements.declaredProblems.value = vehicle?.declaredProblems || '';
  form.elements.foundProblems.value = vehicle?.foundProblems || '';
  form.elements.status.value = vehicle?.status || 'da_controllare';

  $('#vehicleDialog').showModal();
}

async function saveVehicle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const normalizedPlate = normalizePlate(data.plate);
  const error = $('#vehicleFormError');
  error.textContent = '';

  if (!normalizedPlate || !data.firstName.trim()) {
    error.textContent = 'Inserisci almeno targa e nome.';
    return;
  }

  const duplicate = await vehicles.getByPlate(normalizedPlate);
  if (duplicate && duplicate.id !== data.id) {
    error.textContent = 'Questa targa è già presente.';
    return;
  }

  const previous = data.id ? await vehicles.get(data.id) : null;
  const record = {
    id: data.id || uuid(),
    plate: normalizedPlate,
    normalizedPlate,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone: data.phone.trim(),
    brand: data.brand.trim(),
    model: data.model.trim(),
    mileageKm: String(data.mileageKm || '').replace(/\D/g,''),
    declaredProblems: data.declaredProblems.trim(),
    foundProblems: data.foundProblems.trim(),
    status: data.status,
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await vehicles.save(record);
  await refreshVehicles();
  renderVehicleList();
  backup.scheduleVehicle(record.id);

  $('#vehicleDialog').close();
  toast(previous ? 'Scheda aggiornata' : 'Ingresso salvato');
  await openVehicle(record.id);
}

function openJobForm(vehicle) {
  const form = $('#jobForm');
  form.reset();
  form.elements.vehicleId.value = vehicle.id;
  form.elements.date.value = new Date().toISOString().slice(0,10);
  form.elements.mileageKm.value = vehicle.mileageKm || '';
  $('#jobFormError').textContent = '';
  $('#jobDialog').showModal();
}

async function saveJob(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (!data.workDone.trim()) {
    $('#jobFormError').textContent = 'Scrivi il lavoro eseguito.';
    return;
  }

  const vehicle = await vehicles.get(data.vehicleId);
  if (!vehicle) return;

  const record = {
    id: uuid(),
    vehicleId: vehicle.id,
    date: data.date,
    mileageKm: String(data.mileageKm || '').replace(/\D/g,''),
    workDone: data.workDone.trim(),
    customerNotes: data.customerNotes.trim(),
    internalNotes: data.internalNotes.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await jobs.save(record);
  if (record.mileageKm) {
    vehicle.mileageKm = record.mileageKm;
    vehicle.updatedAt = nowIso();
    await vehicles.save(vehicle);
  }

  backup.scheduleVehicle(vehicle.id, 200);
  $('#jobDialog').close();
  toast('Intervento registrato');
  await refreshVehicles();
  await renderVehicleDetail();
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
}

async function saveSelectedPhotos(files) {
  const vehicleId = state.photoVehicleId;
  const phase = $('#photoPhase').value;
  if (!vehicleId) return;

  let count = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const blob = await compressImage(file);
    const photo = {
      id: uuid(),
      vehicleId,
      phase,
      createdAt: nowIso(),
      blob,
      backupLocal: false,
      backupDrive: false,
    };
    await photos.save(photo);
    backup.syncPhoto(photo).catch(() => {});
    count++;
  }

  $('#photoInput').value = '';
  $('#photoDialog').close();
  toast(count === 1 ? 'Foto salvata' : `${count} foto salvate`);
  await renderVehicleDetail();
}

async function refreshInventory() {
  state.inventory = await inventory.all();
  state.inventory.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function inventoryLocation(item) {
  return [
    item.shelf ? `Scaffale ${item.shelf}` : '',
    item.level ? `Ripiano ${item.level}` : '',
    item.drawer ? `Cassetto ${item.drawer}` : '',
  ].filter(Boolean).join(' · ') || 'Posizione non assegnata';
}

function renderInventory() {
  refreshInventory().then(() => {
    const q = $('#inventorySearch').value.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const list = state.inventory.filter(item => {
      if (!tokens.length) return true;
      const hay = [
        item.name,item.category,item.brand,item.partNumber,item.compatibleWith,
        item.shelf,item.level,item.drawer,item.condition,item.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      return tokens.every(token => hay.includes(token));
    });

    $('#inventoryResults').innerHTML = list.length ? list.map(item => `
      <article class="inventory-card">
        <div class="inventory-top">
          <div>
            <h3 style="margin-bottom:4px">${esc(item.name)}</h3>
            <p class="muted">${esc([item.category,item.brand,item.partNumber].filter(Boolean).join(' · '))}</p>
          </div>
          <span class="condition ${esc(item.condition || 'buono')}">${esc((item.condition || 'buono')[0].toUpperCase() + (item.condition || 'buono').slice(1))}</span>
        </div>
        ${item.compatibleWith ? `<p>Compatibile: <b>${esc(item.compatibleWith)}</b></p>` : ''}
        <div class="location">${esc(inventoryLocation(item))}</div>
        <div class="qty-actions">
          <button data-adjust-id="${item.id}" data-delta="-1">−</button>
          <strong>${item.quantity ?? 0} pz</strong>
          <button data-adjust-id="${item.id}" data-delta="1">+</button>
        </div>
      </article>
    `).join('') : '<div class="info-card"><p>Nessun ricambio trovato.</p></div>';

    $$('[data-adjust-id]').forEach(button => {
      button.onclick = async () => {
        const item = await inventory.get(button.dataset.adjustId);
        const next = Math.max(0, Number(item.quantity || 0) + Number(button.dataset.delta));
        item.quantity = next;
        item.updatedAt = nowIso();
        await inventory.save(item);
        backup.syncInventory().catch(() => {});
        renderInventory();
      };
    });
  });
}

async function saveInventory(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (!data.name.trim()) {
    $('#inventoryFormError').textContent = 'Inserisci il nome del ricambio.';
    return;
  }

  const record = {
    id: uuid(),
    name: data.name.trim(),
    category: data.category.trim(),
    brand: data.brand.trim(),
    partNumber: data.partNumber.trim(),
    compatibleWith: data.compatibleWith.trim(),
    quantity: Math.max(0, Number(data.quantity || 0)),
    shelf: data.shelf.trim().toUpperCase(),
    level: data.level.trim(),
    drawer: data.drawer.trim(),
    condition: data.condition,
    notes: data.notes.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await inventory.save(record);
  backup.syncInventory().catch(() => {});
  $('#inventoryDialog').close();
  toast('Ricambio salvato');
  renderInventory();
}

async function renderBackup() {
  const s = await destinations.status();
  $('#localBackupStatus').textContent = s.local?.configured ? (s.local.label || 'Configurata') : 'Da configurare';
  $('#driveBackupStatus').textContent = s.drive?.configured ? (s.drive.label || 'Configurata') : 'Da configurare';

  const last = await meta.get('lastBackupAt');
  $('#lastBackupText').textContent = 'Ultimo allineamento: ' + (
    last ? new Date(last).toLocaleString('it-IT') : 'mai'
  );
}

async function chooseBackup(slot) {
  try {
    await destinations.choose(slot);
    await backup.resetSlot(slot);
    toast('Destinazione configurata');
    await backup.syncAll();
    await renderBackup();
  } catch (error) {
    toast(error.message);
  }
}

async function syncAll() {
  try {
    toast('Allineamento avviato');
    const ok = await backup.syncAll();
    toast(ok ? 'Copie aggiornate' : 'Configura almeno una destinazione');
    await renderBackup();
  } catch (error) {
    toast(error.message);
  }
}

function wireUi() {
  $('#newVehicleButton').onclick = () => openVehicleForm();
  $('#vehicleForm').addEventListener('submit', saveVehicle);
  $('#jobForm').addEventListener('submit', saveJob);
  $('#inventoryForm').addEventListener('submit', saveInventory);

  $('#vehicleSearch').addEventListener('input', renderVehicleList);
  $('#clearVehicleSearch').onclick = () => {
    $('#vehicleSearch').value = '';
    renderVehicleList();
    $('#vehicleSearch').focus();
  };

  $('#inventorySearch').addEventListener('input', renderInventory);
  $('#clearInventorySearch').onclick = () => {
    $('#inventorySearch').value = '';
    renderInventory();
    $('#inventorySearch').focus();
  };

  $('#newInventoryButton').onclick = () => {
    $('#inventoryForm').reset();
    $('#inventoryForm').elements.quantity.value = 1;
    $('#inventoryForm').elements.condition.value = 'buono';
    $('#inventoryFormError').textContent = '';
    $('#inventoryDialog').showModal();
  };

  $('#choosePhotosButton').onclick = () => $('#photoInput').click();
  $('#photoInput').addEventListener('change', e => saveSelectedPhotos([...e.target.files]));

  $('#chooseLocalButton').onclick = () => chooseBackup('local');
  $('#chooseDriveButton').onclick = () => chooseBackup('drive');
  $('#syncAllButton').onclick = syncAll;
  $('#backupShortcut').onclick = () => showView('backup');

  $$('.bottom-nav button').forEach(button => {
    button.onclick = () => showView(button.dataset.view);
  });

  $$('[data-close]').forEach(button => {
    button.onclick = () => $('#' + button.dataset.close).close();
  });

  $('#vehicleForm').elements.plate.addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });
}

async function start() {
  wireUi();
  await refreshVehicles();
  renderVehicleList();
  await refreshInventory();
  backup.syncMetadata().catch(() => {});
  backup.retryPendingPhotos().catch(() => {});

  if (window.Capacitor?.isNativePlatform?.()) {
    const App = window.Capacitor.Plugins.App;
    App?.addListener?.('backButton', () => {
      if (state.view === 'vehicle') showView('home');
    });
    App?.addListener?.('appStateChange', ({ isActive }) => {
      if (!isActive) backup.syncMetadata().catch(() => {});
      if (isActive) backup.retryPendingPhotos().catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', start);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
