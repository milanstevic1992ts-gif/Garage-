import {
  vehicles, jobs, photos, inventory, stockMovements, meta,
  uuid, nowIso, normalizePlate,
} from './db.js';
import { customerName, vehicleLabel } from './archive.js';
import * as backup from './backup.js';
import * as destinations from './destinations.js';
import {
  smartInventorySearch, smartVehicleSearch, inventoryQueryHint,
  suggestInventoryLocations,
} from './search-ai.js';
import {
  orderRoughNotes, rewriteWorkshopNotes, suggestInventoryTerms, normalizeWorkshopDictation,
} from './notes-ai.js';
import { scanShelf } from './shelf-scanner.js';
import { startDictation, stopDictation, cancelDictation, isSpeechAvailable } from './speech.js';

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
  placementMode: 'relocate',
  activeVoicePanel: null,
  pendingInventoryPhoto: null,
  pendingInventoryPhotoUrl: '',
  pendingJobPhotos: [],
  pendingJobPhotoUrls: [],
  existingJobPhotoUrls: [],
};

const STATUS = {
  da_controllare: 'Da controllare',
  in_lavorazione: 'In lavorazione',
  attesa_ricambi: 'In attesa',
  pronto: 'Pronto',
  consegnato: 'Completato',
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


function directVoicePanelMarkup(entity, entityId, title, targets, compact = false) {
  return `
    <div class="voice-panel ${compact ? 'compact-voice' : ''}" data-voice-panel data-voice-entity="${entity}" data-entity-id="${entityId}">
      <div class="voice-main">
        <button type="button" class="voice-mic" data-voice-toggle aria-label="${esc(title)}">🎙</button>
        <div class="voice-copy">
          <strong>${esc(title)}</strong>
          <span data-voice-status>Tocca il microfono e parla</span>
        </div>
      </div>
      <div class="voice-targets ${targets.length === 1 ? 'hidden' : ''}">
        ${targets.map((target,index)=>`<button type="button" class="${index===0?'active':''}" data-voice-target="${target.field}">${esc(target.label)}</button>`).join('')}
      </div>
      <div class="voice-preview" data-voice-preview>Il testo dettato apparirà qui.</div>
    </div>
  `;
}

function vehicleCard(vehicle) {
  const bikeAsset = /ducati|monster|moto/i.test([vehicle.brand, vehicle.model].filter(Boolean).join(' '))
    ? 'assets/vehicle-bike.svg'
    : 'assets/vehicle-scooter.svg';
  return `
    <button class="vehicle-card premium-vehicle-card" data-vehicle-id="${vehicle.id}">
      <img class="vehicle-thumb" src="${bikeAsset}" alt="">
      <div class="vehicle-card-main">
        <div class="vehicle-card-line">
          <span class="plate">${esc(vehicle.plate || 'SENZA TARGA')}</span>
          <span class="status ${esc(vehicle.status)}">${esc(STATUS[vehicle.status] || 'Da controllare')}</span>
        </div>
        <h3>${esc(customerName(vehicle))}</h3>
        <p>${esc(vehicleLabel(vehicle) || 'Marca/modello non indicati')}${vehicle.mileageKm ? ` · ${Number(vehicle.mileageKm).toLocaleString('it-IT')} km` : ''}</p>
        ${vehicle.verifiedMileageKm ? `<small class="verified-mini">✓ ${Number(vehicle.verifiedMileageKm).toLocaleString('it-IT')} km verificati</small>` : ''}
      </div>
      <span class="card-chevron">›</span>
    </button>
  `;
}

function renderVehicleList() {
  const q = $('#vehicleSearch').value.trim();
  const allMatches = smartVehicleSearch(state.vehicles, q);
  const showAll = $('#showAllVehicles')?.dataset?.all === '1';
  const list = q || showAll ? allMatches : allMatches.slice(0, 3);

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
  const generalVehiclePhotos = vehiclePhotos.filter(photo => !photo.jobId);
  const tel = String(vehicle.phone || '').replace(/\s/g,'');

  $('#vehicleView').innerHTML = `
    <div class="detail-head">
      <button class="back-btn" id="backHome">‹ Garage</button>
      <button class="edit-pill" id="editVehicleButton">✎ Modifica</button>
    </div>

    <div class="vehicle-summary-card">
      <img class="vehicle-summary-image" src="assets/vehicle-scooter.svg" alt="">
      <div class="vehicle-summary-copy">
        <div class="vehicle-summary-top">
          <span class="plate">${esc(vehicle.plate || 'SENZA TARGA')}</span>
          <span class="status ${esc(vehicle.status)}">${esc(STATUS[vehicle.status] || 'Da controllare')}</span>
        </div>
        <h2>${esc(customerName(vehicle))}</h2>
        <p>${esc(vehicleLabel(vehicle) || 'Marca/modello non indicati')}${vehicle.mileageKm ? ` · ${Number(vehicle.mileageKm).toLocaleString('it-IT')} km` : ''}</p>
        ${tel ? `<a class="vehicle-phone" href="tel:${esc(tel)}">☎ Tel. ${esc(vehicle.phone)}</a>` : ''}
      </div>
    </div>

    <div class="quick-actions premium-actions">
      ${tel ? `<a href="tel:${esc(tel)}">☎ <span>Chiama</span></a>` : '<button disabled>☎ <span>Telefono</span></button>'}
      <button id="addJobButton">＋ <span>Nuovo intervento</span></button>
      <button id="addPhotoButton">▣ <span>Foto</span></button>
    </div>

    <div class="problem-stack">
      <div class="problem-card premium-problem-card">
        <div class="problem-title-row"><small>▤ &nbsp; PROBLEMI DICHIARATI</small><span>Modifica</span></div>
        <p>${esc(vehicle.declaredProblems || '—')}</p>
      </div>
      <div class="problem-card premium-problem-card">
        <div class="problem-title-row"><small>🔧 &nbsp; PROBLEMI RISCONTRATI</small><span>Modifica</span></div>
        <p>${esc(vehicle.foundProblems || '—')}</p>
        <div class="search-suggestions" id="problemSearchSuggestions"></div>
      </div>
    </div>

    ${directVoicePanelMarkup('vehicle', vehicle.id, 'Detta appunti', [
      { field:'declaredProblems', label:'Dichiarati' },
      { field:'foundProblems', label:'Riscontrati' },
    ])}

    <div class="section-title"><strong>Fotografie</strong><span>${generalVehiclePhotos.length}</span></div>
    <div class="gallery" id="vehicleGallery">
      ${generalVehiclePhotos.length ? generalVehiclePhotos.map(photo => `
        <img data-photo-id="${photo.id}" alt="${esc(photo.phase || 'foto')}" src="${URL.createObjectURL(photo.blob)}">
      `).join('') : '<div class="info-card"><p>Nessuna foto ancora.</p></div>'}
    </div>

    <div class="section-title"><strong>Interventi</strong><span>${vehicleJobs.length}</span></div>
    <div class="stack">
      ${vehicleJobs.length ? vehicleJobs.map(job => `
        <article class="job-card">
          <div class="card-top">
            <strong>${esc(job.date)}</strong>
            <div class="job-card-tools">
              <small>${job.mileageKm ? esc(job.mileageKm) + ' km' : ''}</small>
              <button type="button" class="job-edit-button" data-edit-job-id="${job.id}">✎ Modifica</button>
            </div>
          </div>
          <p style="margin:9px 0 0">${esc(job.workDone)}</p>
          ${job.customerNotes ? `<p class="muted">${esc(job.customerNotes)}</p>` : ''}
          ${(() => {
            const jobPhotos = vehiclePhotos.filter(photo => photo.jobId === job.id);
            return jobPhotos.length ? `
              <div class="job-photo-strip">
                ${jobPhotos.map((photo,index) => `
                  <img class="job-photo-thumb" data-job-photo="1" alt="Foto intervento ${index + 1}" src="${URL.createObjectURL(photo.blob)}">
                `).join('')}
              </div>
            ` : '';
          })()}
        </article>
      `).join('') : '<div class="info-card"><p>Nessun intervento registrato.</p></div>'}
    </div>
  `;

  $('#backHome').onclick = () => showView('home');
  $('#editVehicleButton').onclick = () => openVehicleForm(vehicle);
  $('#addJobButton').onclick = () => openJobForm(vehicle, null);
  $('#addPhotoButton').onclick = () => {
    state.photoVehicleId = vehicle.id;
    $('#photoDialog').showModal();
  };

  $('[data-edit-job-id]').forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();
      const job = await jobs.get(button.dataset.editJobId);
      if (job) await openJobForm(vehicle, job);
    };
  });

  $('#vehicleGallery img[data-photo-id], .job-photo-thumb[data-job-photo="1"]').forEach(img => {
    img.onclick = () => {
      const dialog = $('#photoViewerDialog');
      const viewer = $('#photoViewerImage');
      viewer.src = img.src;
      viewer.alt = img.alt || 'Foto';
      dialog.showModal();
    };
  });

  const terms = suggestInventoryTerms(
    [vehicle.declaredProblems, vehicle.foundProblems].filter(Boolean).join(' ')
  );
  const suggestionBox = $('#problemSearchSuggestions');
  suggestionBox.innerHTML = terms.map(term =>
    `<button type="button" data-search-part="${esc(term)}">${esc(term)}</button>`
  ).join('');
  suggestionBox.querySelectorAll('[data-search-part]').forEach(button => {
    button.onclick = () => {
      $('#inventorySearch').value = button.dataset.searchPart;
      showView('inventory');
    };
  });
  wireVoicePanels($('#vehicleView'));
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
  form.elements.year.value = vehicle?.year || '';
  form.elements.declaredProblems.value = vehicle?.declaredProblems || '';
  form.elements.foundProblems.value = vehicle?.foundProblems || '';
  form.elements.status.value = vehicle?.status || 'da_controllare';

  $('#vehicleDialog').showModal();
}

async function saveVehicle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const normalizedPlate = normalizePlate(data.plate || '');
  const firstName = String(data.firstName || '').trim();
  const error = $('#vehicleFormError');
  error.textContent = '';

  if (!firstName) {
    error.textContent = 'Inserisci almeno il nome del cliente.';
    return;
  }

  try {
    if (normalizedPlate) {
      const duplicate = await vehicles.getByPlate(normalizedPlate);
      if (duplicate && duplicate.id !== data.id) {
        error.textContent = 'Questa targa è già presente.';
        return;
      }
    }

    const previous = data.id ? await vehicles.get(data.id) : null;
    const record = {
      id: data.id || uuid(),
      plate: normalizedPlate,
      firstName,
      lastName: String(data.lastName || '').trim(),
      phone: String(data.phone || '').trim(),
      brand: String(data.brand || '').trim(),
      model: String(data.model || '').trim(),
      year: String(data.year || '').replace(/\D/g,'').slice(0,4),
      mileageKm: String(data.mileageKm || '').replace(/\D/g,''),
      declaredProblems: String(data.declaredProblems || '').trim(),
      foundProblems: String(data.foundProblems || '').trim(),
      status: data.status || 'da_controllare',
      createdAt: previous?.createdAt || nowIso(),
      updatedAt: nowIso(),
      ...(normalizedPlate ? { normalizedPlate } : {}),
    };

    await vehicles.save(record);
    await refreshVehicles();
    renderVehicleList();
    backup.scheduleVehicle(record.id);

    $('#vehicleDialog').close();
    toast(previous ? 'Cliente aggiornato' : 'Nuovo cliente salvato');
    await openVehicle(record.id);
  } catch (saveError) {
    console.error(saveError);
    error.textContent = 'Non riesco a salvare il cliente. Riprova.';
    toast('Errore durante il salvataggio');
  }
}

function renderPendingJobPhotos() {
  const preview = $('#jobPhotoPreview');
  if (!preview) return;

  const existingMarkup = state.existingJobPhotoUrls.map((url,index) =>
    `<button type="button" class="job-photo-existing" data-existing-job-photo="${index}" aria-label="Apri foto già salvata ${index + 1}">
       <img src="${url}" alt="Foto intervento già salvata ${index + 1}">
       <small>Salvata</small>
     </button>`
  ).join('');

  const pendingMarkup = state.pendingJobPhotoUrls.map((url,index) =>
    `<button type="button" class="job-photo-draft" data-remove-job-photo="${index}" aria-label="Rimuovi nuova foto ${index + 1}">
       <img src="${url}" alt="Nuova foto intervento ${index + 1}">
       <span>×</span>
     </button>`
  ).join('');

  preview.innerHTML = existingMarkup + pendingMarkup
    || '<span class="job-photo-empty">Nessuna foto aggiunta</span>';

  preview.querySelectorAll('[data-existing-job-photo]').forEach(button => {
    button.onclick = () => {
      const img = button.querySelector('img');
      $('#photoViewerImage').src = img.src;
      $('#photoViewerImage').alt = img.alt;
      $('#photoViewerDialog').showModal();
    };
  });

  preview.querySelectorAll('[data-remove-job-photo]').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.removeJobPhoto);
      const [url] = state.pendingJobPhotoUrls.splice(index, 1);
      if (url) URL.revokeObjectURL(url);
      state.pendingJobPhotos.splice(index, 1);
      renderPendingJobPhotos();
    };
  });
}

async function openJobForm(vehicle, job = null) {
  const form = $('#jobForm');
  form.reset();

  form.elements.id.value = job?.id || '';
  form.elements.vehicleId.value = vehicle.id;
  form.elements.date.value = job?.date || new Date().toISOString().slice(0,10);
  form.elements.mileageKm.value = job?.mileageKm || vehicle.mileageKm || '';
  form.elements.workDone.value = job?.workDone || '';
  form.elements.customerNotes.value = job?.customerNotes || '';
  form.elements.internalNotes.value = job?.internalNotes || '';

  $('#jobFormTitle').textContent = job ? 'Modifica intervento' : 'Nuovo intervento';
  $('#jobSubmitButton').textContent = job ? 'Salva modifiche' : 'Salva nuovo intervento';
  $('#jobFormError').textContent = '';

  state.pendingJobPhotos = [];
  state.pendingJobPhotoUrls.forEach(url => URL.revokeObjectURL(url));
  state.pendingJobPhotoUrls = [];
  state.existingJobPhotoUrls.forEach(url => URL.revokeObjectURL(url));
  state.existingJobPhotoUrls = [];
  $('#jobPhotoInput').value = '';

  if (job) {
    const existing = (await photos.byVehicle(vehicle.id)).filter(photo => photo.jobId === job.id);
    state.existingJobPhotoUrls = existing.map(photo => URL.createObjectURL(photo.blob));
  }
  renderPendingJobPhotos();

  $('#jobDialog').showModal();
}

async function saveJob(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const error = $('#jobFormError');
  error.textContent = '';

  if (!String(data.workDone || '').trim()) {
    error.textContent = 'Scrivi il lavoro eseguito.';
    return;
  }

  const vehicle = await vehicles.get(data.vehicleId);
  if (!vehicle) {
    error.textContent = 'Veicolo non trovato.';
    return;
  }

  try {
    const previous = data.id ? await jobs.get(data.id) : null;
    const record = {
      id: data.id || uuid(),
      vehicleId: vehicle.id,
      date: data.date,
      mileageKm: String(data.mileageKm || '').replace(/\D/g,''),
      workDone: String(data.workDone || '').trim(),
      customerNotes: String(data.customerNotes || '').trim(),
      internalNotes: String(data.internalNotes || '').trim(),
      createdAt: previous?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    await jobs.save(record);

    for (const blob of state.pendingJobPhotos) {
      const photo = {
        id: uuid(),
        vehicleId: vehicle.id,
        jobId: record.id,
        phase: 'intervento',
        createdAt: nowIso(),
        blob,
        backupLocal: false,
        backupDrive: false,
      };
      await photos.save(photo);
      backup.syncPhoto(photo).catch(() => {});
    }

    state.pendingJobPhotos = [];
    state.pendingJobPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    state.pendingJobPhotoUrls = [];
    state.existingJobPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    state.existingJobPhotoUrls = [];

    if (record.mileageKm) {
      const allVehicleJobs = await jobs.byVehicle(vehicle.id);
      const newestDate = allVehicleJobs
        .filter(item => item.id !== record.id)
        .map(item => String(item.date || ''))
        .sort()
        .at(-1) || '';
      if (!newestDate || String(record.date || '') >= newestDate) {
        vehicle.mileageKm = record.mileageKm;
        vehicle.updatedAt = nowIso();
        await vehicles.save(vehicle);
      }
    }

    backup.scheduleVehicle(vehicle.id, 200);
    $('#jobDialog').close();
    toast(previous ? 'Intervento aggiornato' : 'Nuovo intervento registrato');
    await refreshVehicles();
    await renderVehicleDetail();
  } catch (saveError) {
    console.error(saveError);
    error.textContent = 'Non riesco a salvare l’intervento. Riprova.';
    toast('Errore durante il salvataggio');
  }
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
    const q = $('#inventorySearch').value.trim();
    const showWithdrawn = $('#showWithdrawn')?.checked;
    const source = state.inventory.filter(item =>
      showWithdrawn || Number(item.quantity || 0) > 0
    );
    const list = smartInventorySearch(source, q);
    const hint = inventoryQueryHint(q);
    const resultMeta = $('#inventoryResultMeta');
    if (resultMeta) resultMeta.textContent = list.length === 1 ? '1 risultato' : `${list.length} risultati`;
    $('#inventoryAiHint').textContent = q
      ? (hint ? `Mini AI · ${hint}` : 'Mini AI · ricerca intelligente attiva')
      : 'Mini AI · prova “carb Betwin verde scaffale C ripiano 2”';

    $('#inventoryResults').innerHTML = list.length ? list.map(item => {
      const withdrawn = Number(item.quantity || 0) <= 0;
      return `
      <article class="inventory-card premium-inventory-card ${withdrawn ? 'withdrawn' : ''}">
        <div class="inventory-product">
          <img class="part-thumb" data-inventory-photo="${item.photoBlob ? '1' : '0'}" data-item-id="${item.id}" src="${item.photoBlob ? URL.createObjectURL(item.photoBlob) : 'assets/part-carb.svg'}" alt="${esc(item.name)}">
          <div class="inventory-product-copy">
            <h3>${esc(item.name)}</h3>
            <p class="muted">${esc([item.category,item.brand,item.partNumber].filter(Boolean).join(' · '))}</p>
            ${item.compatibleWith ? `<p class="compatibility">Compatibile: ${esc(item.compatibleWith)}</p>` : ''}
            <div class="location">⌖ &nbsp; ${withdrawn ? 'PRELEVATO · ultima posizione: ' : ''}${esc(inventoryLocation(item))}</div>
            <div class="inventory-state-row">
              <span class="condition ${esc(item.condition || 'buono')}">${esc((item.condition || 'buono')[0].toUpperCase() + (item.condition || 'buono').slice(1))}</span>
              <span>${withdrawn ? 'Non disponibile' : `${item.quantity ?? 0} pz disponibile${Number(item.quantity||0) === 1 ? '' : 'i'}`}</span>
            </div>
          </div>
        </div>
        <div class="inventory-actions">
          ${withdrawn ? '' : `<button class="withdraw-btn" data-withdraw-id="${item.id}">▣ &nbsp; PRELEVA 1</button>`}
          <button class="putaway-btn" data-putaway-id="${item.id}">⇄ &nbsp; ${withdrawn ? 'RIPONI' : (item.shelf ? 'SPOSTA' : 'METTI SU SCAFFALE')}</button>
        </div>
        ${directVoicePanelMarkup('inventory', item.id, 'Detta note ricambio', [
          { field:'notes', label:'Note' },
        ], true)}
      </article>`;
    }).join('') : '<div class="info-card"><p>Nessun ricambio trovato.</p></div>';

    $('.part-thumb[data-inventory-photo="1"]').forEach(img => {
      img.onclick = () => {
        const dialog = $('#photoViewerDialog');
        const viewer = $('#photoViewerImage');
        viewer.src = img.src;
        viewer.alt = img.alt || 'Foto ricambio';
        dialog.showModal();
      };
    });

    $('[data-withdraw-id]').forEach(button => {
      button.onclick = () => withdrawInventoryItem(button.dataset.withdrawId);
    });
    $('[data-putaway-id]').forEach(button => {
      button.onclick = async () => {
        const item = await inventory.get(button.dataset.putawayId);
        openPlacement(item, Number(item.quantity || 0) <= 0 ? 'restock' : 'relocate');
      };
    });
    wireVoicePanels($('#inventoryResults'));
  });
}

async function recordStockMovement(item, type, delta, extra = {}) {
  await stockMovements.save({
    id: uuid(),
    itemId: item.id,
    itemName: item.name,
    type,
    delta,
    quantityAfter: Number(item.quantity || 0),
    shelf: item.shelf || '',
    level: item.level || '',
    drawer: item.drawer || '',
    createdAt: nowIso(),
    ...extra,
  });
}

async function withdrawInventoryItem(id) {
  const item = await inventory.get(id);
  if (!item || Number(item.quantity || 0) <= 0) return;

  item.quantity = Math.max(0, Number(item.quantity || 0) - 1);
  item.status = item.quantity === 0 ? 'taken' : 'available';
  item.takenAt = item.quantity === 0 ? nowIso() : null;
  item.updatedAt = nowIso();
  await inventory.save(item);
  await recordStockMovement(item, 'withdraw', -1);

  backup.syncInventory().catch(() => {});
  toast(item.quantity === 0 ? 'Pezzo prelevato · non più disponibile' : 'Prelevato 1 pezzo');
  renderInventory();
}

function draftFromInventoryForm() {
  const form = $('#inventoryForm');
  return {
    id: '',
    name: form.elements.name.value.trim(),
    category: form.elements.category.value.trim(),
    brand: form.elements.brand.value.trim(),
    compatibleWith: form.elements.compatibleWith.value.trim(),
  };
}

function applyLocation(form, location) {
  form.elements.shelf.value = location.shelf || '';
  form.elements.level.value = location.level || '';
  form.elements.drawer.value = location.drawer || '';
}

function renderLocationSuggestions(container, draft, apply) {
  const suggestions = suggestInventoryLocations(state.inventory, draft, 3);
  container.innerHTML = suggestions.length
    ? suggestions.map((s, index) => {
        const label = [
          `Scaffale ${s.shelf}`,
          s.level ? `Ripiano ${s.level}` : '',
          s.drawer ? `Cassetto ${s.drawer}` : '',
        ].filter(Boolean).join(' · ');
        return `<button type="button" class="suggestion-chip" data-suggestion="${index}">✦ ${esc(label)}${s.reason ? ` · ${esc(s.reason)}` : ''}</button>`;
      }).join('')
    : '<span class="muted" style="font-size:11px">Nessuna posizione simile: scegli tu lo scaffale.</span>';

  container.querySelectorAll('[data-suggestion]').forEach(button => {
    button.onclick = () => apply(suggestions[Number(button.dataset.suggestion)]);
  });
}

async function scanIntoForm(form) {
  try {
    const location = await scanShelf();
    applyLocation(form, location);
    toast(`Scaffale ${location.shelf} acquisito`);
  } catch (error) {
    toast(error.message);
  }
}

function openPlacement(item, mode = 'relocate') {
  state.placementMode = mode;
  const form = $('#placementForm');
  form.reset();
  form.elements.itemId.value = item.id;
  form.elements.quantity.value = 1;
  form.elements.quantity.disabled = mode === 'relocate';
  $('#placementQuantityLabel').classList.toggle('hidden', mode === 'relocate');
  form.elements.shelf.value = item.shelf || '';
  form.elements.level.value = item.level || '';
  form.elements.drawer.value = item.drawer || '';
  $('#placementFormError').textContent = '';
  renderLocationSuggestions($('#placementSuggestions'), item, location => applyLocation(form, location));
  $('#placementDialog').showModal();
}

async function savePlacement(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const item = await inventory.get(form.elements.itemId.value);
  if (!item) return;

  const shelf = form.elements.shelf.value.trim().toUpperCase();
  if (!shelf) {
    $('#placementFormError').textContent = 'Indica o scansiona lo scaffale.';
    return;
  }

  const delta = state.placementMode === 'restock'
    ? Math.max(1, Number(form.elements.quantity.value || 1))
    : 0;

  item.shelf = shelf;
  item.level = form.elements.level.value.trim();
  item.drawer = form.elements.drawer.value.trim();
  item.quantity = Number(item.quantity || 0) + delta;
  item.status = item.quantity > 0 ? 'available' : item.status;
  item.takenAt = item.quantity > 0 ? null : item.takenAt;
  item.updatedAt = nowIso();

  await inventory.save(item);
  await recordStockMovement(
    item,
    state.placementMode === 'restock' ? 'putaway' : 'relocate',
    delta,
    { source: 'manual_or_scan' },
  );

  $('#placementDialog').close();
  backup.syncInventory().catch(() => {});
  toast(state.placementMode === 'restock' ? 'Pezzo riposto in magazzino' : 'Posizione aggiornata');
  renderInventory();
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
    photoBlob: state.pendingInventoryPhoto || null,
    status: Math.max(0, Number(data.quantity || 0)) > 0 ? 'available' : 'taken',
    takenAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await inventory.save(record);
  state.pendingInventoryPhoto = null;
  if (state.pendingInventoryPhotoUrl) {
    URL.revokeObjectURL(state.pendingInventoryPhotoUrl);
    state.pendingInventoryPhotoUrl = '';
  }
  await recordStockMovement(record, 'intake', Number(record.quantity || 0));
  backup.syncInventory().catch(() => {});
  $('#inventoryDialog').close();
  toast('Ricambio salvato');

  await refreshInventory();
  if (Number(record.quantity || 0) > 0 && !record.shelf) {
    openPlacement(record, 'relocate');
  } else {
    renderInventory();
  }
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


async function saveDirectDictation(panel, target, text) {
  const clean = normalizeWorkshopDictation(text);
  if (!clean) return false;

  const entity = panel.dataset.voiceEntity;
  const entityId = panel.dataset.entityId;

  if (entity === 'vehicle') {
    const vehicle = await vehicles.get(entityId);
    if (!vehicle || !['declaredProblems','foundProblems'].includes(target)) return false;
    const current = String(vehicle[target] || '').trim();
    vehicle[target] = current ? `${current}\n${clean}` : clean;
    vehicle.updatedAt = nowIso();
    await vehicles.save(vehicle);
    backup.scheduleVehicle(vehicle.id, 150);
    await refreshVehicles();
    await renderVehicleDetail();
    return true;
  }

  if (entity === 'inventory') {
    const item = await inventory.get(entityId);
    if (!item || target !== 'notes') return false;
    const current = String(item.notes || '').trim();
    item.notes = current ? `${current}\n${clean}` : clean;
    item.updatedAt = nowIso();
    await inventory.save(item);
    backup.syncInventory().catch(() => {});
    renderInventory();
    return true;
  }

  return false;
}

function appendDictation(field, text) {
  const clean = normalizeWorkshopDictation(text);
  if (!field || !clean) return;
  const current = field.value.trim();
  field.value = current ? `${current}\n${clean}` : clean;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function selectedVoiceTarget(panel) {
  return panel.querySelector('[data-voice-target].active')
    || panel.querySelector('[data-voice-target]');
}

function resetVoicePanel(panel, message = 'Tocca il microfono e parla') {
  panel.classList.remove('listening');
  panel.dataset.listening = '0';
  panel.dataset.finishing = '0';
  panel.style.setProperty('--mic-level', '0');
  const status = panel.querySelector('[data-voice-status]');
  const preview = panel.querySelector('[data-voice-preview]');
  const mic = panel.querySelector('[data-voice-toggle]');
  if (status) status.textContent = message;
  if (mic) mic.textContent = '🎙';
  if (preview && !preview.textContent.trim()) preview.textContent = 'Il testo dettato apparirà qui.';
}

async function finishVoicePanel(panel, automatic = false) {
  if (!panel || panel.dataset.finishing === '1') return;
  panel.dataset.finishing = '1';

  const status = panel.querySelector('[data-voice-status]');
  if (status) status.textContent = 'Salvataggio dettatura…';

  let text = '';
  try {
    text = await stopDictation();
  } catch (_) {}

  const targetButton = selectedVoiceTarget(panel);
  const target = targetButton?.dataset?.voiceTarget;
  const form = panel.closest('form');
  const field = form?.elements?.[target];

  if (text && field) {
    appendDictation(field, text);
    const preview = panel.querySelector('[data-voice-preview]');
    if (preview) preview.textContent = text;
    resetVoicePanel(panel, automatic ? 'Dettatura inserita automaticamente' : 'Dettatura inserita');
  } else if (text && panel.dataset.voiceEntity && target) {
    const saved = await saveDirectDictation(panel, target, text);
    if (!saved) resetVoicePanel(panel, 'Nessun testo riconosciuto');
  } else {
    resetVoicePanel(panel, 'Nessun testo riconosciuto');
  }

  if (state.activeVoicePanel === panel) state.activeVoicePanel = null;
}

async function startVoicePanel(panel) {
  if (!isSpeechAvailable()) {
    toast('Microfono disponibile nell’APK Android.');
    return;
  }

  if (state.activeVoicePanel && state.activeVoicePanel !== panel) {
    await finishVoicePanel(state.activeVoicePanel);
  }

  state.activeVoicePanel = panel;
  panel.dataset.listening = '1';
  panel.classList.add('listening');

  const status = panel.querySelector('[data-voice-status]');
  const preview = panel.querySelector('[data-voice-preview]');
  const mic = panel.querySelector('[data-voice-toggle]');

  if (status) status.textContent = 'In ascolto… parla normalmente';
  if (preview) preview.textContent = '…';
  if (mic) mic.textContent = '■';

  try {
    await startDictation({
      onPartial: text => {
        if (preview && text) preview.textContent = text;
      },
      onState: speechState => {
        if (speechState === 'restarting' && status) {
          status.textContent = 'Pausa rilevata… continuo ad ascoltare';
        } else if (speechState === 'started' && status) {
          status.textContent = 'In ascolto… premi stop quando hai finito';
        }
        if (
          speechState === 'stopped' &&
          panel.dataset.listening === '1' &&
          panel.dataset.finishing !== '1'
        ) {
          setTimeout(() => finishVoicePanel(panel, true), 0);
        }
      },
      onError: message => {
        resetVoicePanel(panel, 'Errore microfono');
        toast(message);
      },
    });
  } catch (error) {
    await cancelDictation().catch(() => {});
    resetVoicePanel(panel, 'Microfono non disponibile');
    state.activeVoicePanel = null;
    toast(error.message);
  }
}

function wireVoicePanels(root = document) {
  root.querySelectorAll('[data-voice-panel]').forEach(panel => {
    if (panel.dataset.voiceWired === '1') return;
    panel.dataset.voiceWired = '1';
    panel.dataset.listening = '0';
    panel.dataset.finishing = '0';

    panel.querySelectorAll('[data-voice-target]').forEach(button => {
      button.onclick = () => {
        if (panel.dataset.listening === '1') return;
        panel.querySelectorAll('[data-voice-target]').forEach(x => x.classList.remove('active'));
        button.classList.add('active');
      };
    });

    const mic = panel.querySelector('[data-voice-toggle]');
    if (mic) {
      mic.onclick = async () => {
        if (panel.dataset.listening === '1') await finishVoicePanel(panel);
        else await startVoicePanel(panel);
      };
    }
  });
}

function wireUi() {
  wireVoicePanels();
  $('#newVehicleButton').onclick = () => openVehicleForm();
  $('#showAllVehicles').onclick = () => {
    const el = $('#showAllVehicles');
    el.dataset.all = el.dataset.all === '1' ? '0' : '1';
    el.textContent = el.dataset.all === '1' ? 'Mostra ultimi' : 'Vedi tutti ›';
    renderVehicleList();
  };
  $('#vehicleForm').addEventListener('submit', saveVehicle);
  $('#jobForm').addEventListener('submit', saveJob);
  $('#inventoryForm').addEventListener('submit', saveInventory);
  $('#placementForm').addEventListener('submit', savePlacement);

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
    $('#newItemLocationSuggestions').innerHTML = '';
    state.pendingInventoryPhoto = null;
    if (state.pendingInventoryPhotoUrl) URL.revokeObjectURL(state.pendingInventoryPhotoUrl);
    state.pendingInventoryPhotoUrl = '';
    $('#inventoryPhotoInput').value = '';
    const preview = $('#inventoryPhotoPreview');
    preview.classList.add('empty');
    preview.innerHTML = '<span>📷</span><small>Nessuna foto</small>';
    $('#inventoryPhotoRemove').classList.add('hidden');
    $('#inventoryDialog').showModal();
  };

  $('#showWithdrawn').addEventListener('change', renderInventory);
  $('#suggestShelfNewButton').onclick = () => {
    renderLocationSuggestions(
      $('#newItemLocationSuggestions'),
      draftFromInventoryForm(),
      location => applyLocation($('#inventoryForm'), location),
    );
  };
  $('#inventoryPhotoButton').onclick = () => $('#inventoryPhotoInput').click();
  $('#inventoryPhotoInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const blob = await compressImage(file);
    if (!blob) {
      toast('Impossibile elaborare la foto');
      return;
    }

    state.pendingInventoryPhoto = blob;
    if (state.pendingInventoryPhotoUrl) URL.revokeObjectURL(state.pendingInventoryPhotoUrl);
    state.pendingInventoryPhotoUrl = URL.createObjectURL(blob);

    const preview = $('#inventoryPhotoPreview');
    preview.classList.remove('empty');
    preview.innerHTML = '<img src="' + state.pendingInventoryPhotoUrl + '" alt="Anteprima ricambio">';
    $('#inventoryPhotoRemove').classList.remove('hidden');
  });

  $('#inventoryPhotoRemove').onclick = () => {
    state.pendingInventoryPhoto = null;
    if (state.pendingInventoryPhotoUrl) URL.revokeObjectURL(state.pendingInventoryPhotoUrl);
    state.pendingInventoryPhotoUrl = '';
    $('#inventoryPhotoInput').value = '';
    const preview = $('#inventoryPhotoPreview');
    preview.classList.add('empty');
    preview.innerHTML = '<span>📷</span><small>Nessuna foto</small>';
    $('#inventoryPhotoRemove').classList.add('hidden');
  };

  $('#scanShelfNewButton').onclick = () => scanIntoForm($('#inventoryForm'));
  ['name','category','brand','compatibleWith'].forEach(fieldName => {
    $('#inventoryForm').elements[fieldName].addEventListener('input', () => {
      const draft = draftFromInventoryForm();
      if (![draft.name,draft.category,draft.brand,draft.compatibleWith].some(Boolean)) {
        $('#newItemLocationSuggestions').innerHTML = '';
        return;
      }
      renderLocationSuggestions(
        $('#newItemLocationSuggestions'),
        draft,
        location => applyLocation($('#inventoryForm'), location),
      );
    });
  });
  $('#suggestShelfPlacementButton').onclick = async () => {
    const item = await inventory.get($('#placementForm').elements.itemId.value);
    if (item) renderLocationSuggestions(
      $('#placementSuggestions'),
      item,
      location => applyLocation($('#placementForm'), location),
    );
  };
  $('#scanShelfPlacementButton').onclick = () => scanIntoForm($('#placementForm'));

  $('#choosePhotosButton').onclick = () => $('#photoInput').click();
  $('#photoInput').addEventListener('change', e => saveSelectedPhotos([...e.target.files]));

  $('#jobPhotoButton').onclick = () => $('#jobPhotoInput').click();
  $('#jobPhotoInput').addEventListener('change', async event => {
    const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'));
    for (const file of files) {
      const blob = await compressImage(file);
      if (!blob) continue;
      state.pendingJobPhotos.push(blob);
      state.pendingJobPhotoUrls.push(URL.createObjectURL(blob));
    }
    $('#jobPhotoInput').value = '';
    renderPendingJobPhotos();
  });

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

  $$('[data-order-target]').forEach(button => {
    button.onclick = () => {
      const form = button.closest('form');
      const field = form?.elements?.[button.dataset.orderTarget];
      if (!field || !field.value.trim()) {
        toast('Scrivi prima qualche appunto.');
        return;
      }
      field.value = rewriteWorkshopNotes(field.value, button.dataset.orderTarget);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      toast('Testo riscritto meglio');
    };
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
      if (!isActive) {
        backup.syncMetadata().catch(() => {});
        if (state.activeVoicePanel) finishVoicePanel(state.activeVoicePanel).catch(() => {});
      }
      if (isActive) backup.retryPendingPhotos().catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', start);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
