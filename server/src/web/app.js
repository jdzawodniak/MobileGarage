const API = '/api';

async function fetchJson(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

// Search
document.querySelectorAll('[data-view]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showView(a.dataset.view);
    if (a.dataset.view === 'locations') loadLocations();
    if (a.dataset.view === 'items') loadItems();
    if (a.dataset.view === 'add-item') loadLocationOptions();
    if (a.dataset.view === 'locations') loadFilters();
  });
});

async function loadFilters() {
  const units = await fetchJson('/storage-units');
  const buildings = [...new Set(units.map((u) => u.building_code))].sort();
  const types = [...new Set(units.map((u) => u.storage_type))].sort();
  const fb = document.getElementById('filter-building');
  const ft = document.getElementById('filter-type');
  fb.innerHTML = '<option value="">All buildings</option>' + buildings.map((b) => `<option value="${b}">${b}</option>`).join('');
  ft.innerHTML = '<option value="">All types</option>' + types.map((t) => `<option value="${t}">${t}</option>`).join('');
  fb.onchange = ft.onchange = () => loadLocations();
}

document.getElementById('search-input').addEventListener('input', debounce(async () => {
  const q = document.getElementById('search-input').value.trim();
  const container = document.getElementById('search-results');
  if (!q) { container.innerHTML = ''; return; }
  try {
    const [locs, items] = await Promise.all([
      fetchJson(`/locations?q=${encodeURIComponent(q)}`),
      fetchJson(`/items?q=${encodeURIComponent(q)}`),
    ]);
    container.innerHTML = [
      ...locs.map((l) => `<div class="card" data-type="location" data-id="${l.id}"><h3>${l.location_code}</h3><p>${l.description || 'Location'}</p></div>`),
      ...items.map((i) => `<div class="card" data-type="item" data-id="${i.id}"><h3>${i.name}</h3><p>${i.location_code}</p></div>`),
    ].join('');
    container.querySelectorAll('.card').forEach((c) => {
      c.addEventListener('click', () => {
        if (c.dataset.type === 'location') showLocationDetail(c.dataset.id);
        else showItemDetail(c.dataset.id);
      });
    });
  } catch (e) {
    container.innerHTML = `<p class="error">${e.message}</p>`;
  }
}, 300));

async function loadLocations() {
  const building = document.getElementById('filter-building').value;
  const type = document.getElementById('filter-type').value;
  const params = new URLSearchParams();
  if (building) params.set('building', building);
  if (type) params.set('type', type);
  const rows = await fetchJson('/locations?' + params);
  const list = document.getElementById('locations-list');
  list.innerHTML = rows.map((l) => `
    <div class="card" data-id="${l.id}" style="cursor:pointer">
      <h3>${l.location_code}</h3>
      <p>${l.description || ''} — ${l.building_code} ${l.storage_type} ${l.storage_id}</p>
    </div>
  `).join('');
  list.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('click', () => showLocationDetail(c.dataset.id));
  });
}

async function loadItems() {
  const q = document.getElementById('items-search').value.trim();
  const params = q ? '?q=' + encodeURIComponent(q) : '';
  const rows = await fetchJson('/items' + params);
  const list = document.getElementById('items-list');
  list.innerHTML = rows.map((i) => `
    <div class="card" data-id="${i.id}" style="cursor:pointer">
      <h3>${i.name}</h3>
      <p>${i.location_code}</p>
    </div>
  `).join('');
  list.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('click', () => showItemDetail(c.dataset.id));
  });
}
document.getElementById('items-search').addEventListener('input', debounce(loadItems, 300));

async function showLocationDetail(id) {
  const loc = await fetchJson('/locations/' + id);
  document.getElementById('location-detail-title').textContent = loc.location_code;
  document.getElementById('location-detail-content').innerHTML = `
    <p>${loc.description || ''}</p>
    <p><strong>Items here:</strong></p>
    <ul>${(loc.items || []).map((i) => `<li><a href="#" data-item="${i.id}">${i.name}</a></li>`).join('')}</ul>
  `;
  document.getElementById('location-detail-content').querySelectorAll('[data-item]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); showItemDetail(a.dataset.item); });
  });
  document.getElementById('reprint-large').dataset.id = id;
  showView('location-detail');
}

async function showItemDetail(id) {
  const item = await fetchJson('/items/' + id);
  document.getElementById('item-detail-title').textContent = item.name;
  document.getElementById('item-detail-content').innerHTML = `
    <p><strong>Location:</strong> ${item.location_code}</p>
    <p>${item.notes || ''}</p>
  `;
  document.getElementById('reprint-small').dataset.id = id;
  showView('item-detail');
}

document.getElementById('reprint-large').addEventListener('click', async () => {
  const id = document.getElementById('reprint-large').dataset.id;
  try {
    await fetchJson('/print-jobs/reprint', {
      method: 'POST',
      body: JSON.stringify({ job_type: 'large', reference_type: 'location', reference_id: parseInt(id, 10) }),
    });
    alert('Reprint queued.');
  } catch (e) { alert(e.message); }
});

document.getElementById('reprint-small').addEventListener('click', async () => {
  const id = document.getElementById('reprint-small').dataset.id;
  try {
    await fetchJson('/print-jobs/reprint', {
      method: 'POST',
      body: JSON.stringify({ job_type: 'small', reference_type: 'item', reference_id: parseInt(id, 10) }),
    });
    alert('Reprint queued.');
  } catch (e) { alert(e.message); }
});

async function loadLocationOptions() {
  const locs = await fetchJson('/locations');
  const sel = document.getElementById('item-location-select');
  sel.innerHTML = locs.map((l) => `<option value="${l.id}">${l.location_code}</option>`).join('');
}

document.getElementById('form-storage').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const result = document.getElementById('storage-result');
  try {
    const res = await fetchJson('/storage-units', {
      method: 'POST',
      body: JSON.stringify({
        building_code: data.building_code,
        storage_type: data.storage_type,
        storage_id: data.storage_id,
        spaces_count: parseInt(data.spaces_count, 10),
        description: data.description || null,
      }),
    });
    result.innerHTML = `<p class="success">Created ${res.locations?.length || 0} locations. Large label queued. (e.g. ${res.locations?.[0]?.location_code})</p>`;
    e.target.reset();
    loadFilters();
  } catch (err) {
    result.innerHTML = `<p class="error">${err.message}</p>`;
  }
});

document.getElementById('form-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const result = document.getElementById('item-result');
  let photoPath = null;
  const fileInput = document.getElementById('item-photo');
  if (fileInput.files?.[0]) {
    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    const up = await fetch(API + '/photos', { method: 'POST', body: formData });
    if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error || 'Upload failed');
    const { path: p } = await up.json();
    photoPath = p;
  }
  try {
    const res = await fetchJson('/items', {
      method: 'POST',
      body: JSON.stringify({
        location_id: parseInt(data.location_id, 10),
        name: data.name,
        notes: data.notes || null,
        photo_path: photoPath,
        printer_roll: data.printer_roll || 'left',
      }),
    });
    result.innerHTML = `<p class="success">Item created. Small label queued. (${res.name} @ ${res.location_code})</p>`;
    e.target.reset();
    fileInput.value = '';
    document.getElementById('photo-uploaded').textContent = '';
    loadLocationOptions();
  } catch (err) {
    result.innerHTML = `<p class="error">${err.message}</p>`;
  }
});

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
