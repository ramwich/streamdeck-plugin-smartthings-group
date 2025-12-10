// Property Inspector logic
// - Connects to Stream Deck WebSocket (if port provided) to use setSettings / setGlobalSettings.
// - Falls back to localStorage for development if no host connection.
// - Loads devices/scenes and lets you pick device(s)/scene and command.
// - Saves per-key settings via setSettings and PAT via setGlobalSettings.

import * as ST from './src/smartthings.js';

// Helpers for DOM
const $ = sel => document.querySelector(sel);
const patInput = $('#pat');
const savePatBtn = $('#savePat');
const loadDevicesBtn = $('#loadDevices');
const loadScenesBtn = $('#loadScenes');
const targetType = $('#targetType');

const deviceSection = $('#deviceSection');
const sceneSection = $('#sceneSection');
const groupSection = $('#groupSection');

const deviceSelect = $('#deviceSelect');
const deviceCommand = $('#deviceCommand');
const deviceLevel = $('#deviceLevel');
const deviceLevelLabel = $('#deviceLevelLabel');

const sceneSelect = $('#sceneSelect');

const groupDevices = $('#groupDevices');
const groupCommand = $('#groupCommand');
const groupLevel = $('#groupLevel');
const groupLevelLabel = $('#groupLevelLabel');

const saveSettingsBtn = $('#saveSettings');
const statusEl = $('#status');

let websocket = null;
let piContext = null;
let port = null;
let uuid = null;
let action = null;

// Parse query string for Stream Deck args
function parseQuery() {
  const q = {};
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of params.entries()) q[k] = v;
  return q;
}

// Connect to Stream Deck host WS if port present, otherwise fallback to localStorage
function connect() {
  const q = parseQuery();
  port = q.port;
  uuid = q.uuid || q.pluginUUID || q.context;
  action = q.action;

  if (!port) {
    console.log('No Stream Deck host port in query, running in dev mode (localStorage).');
    // Try to load stored per-key settings from localStorage
    loadSettingsFromLocal();
    return;
  }

  websocket = new WebSocket(`ws://127.0.0.1:${port}`);

  websocket.onopen = () => {
    const register = { event: "registerPropertyInspector", uuid: uuid };
    websocket.send(JSON.stringify(register));
    console.log('PI registered');
    status('Connected to Stream Deck host');
    // request current settings (host will send didReceiveSettings and didReceiveGlobalSettings)
  };

  websocket.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    const { event, payload } = msg;
    if (event === 'didReceiveSettings') {
      // payload.settings is per-key settings
      if (payload && payload.settings) loadSettingsIntoUI(payload.settings);
    } else if (event === 'didReceiveGlobalSettings') {
      if (payload && payload.settings && payload.settings.smartthings_pat) {
        patInput.value = payload.settings.smartthings_pat;
      }
    } else if (event === 'sendToPropertyInspector') {
      // Not used
    }
  };
}

function status(t) {
  statusEl.textContent = t;
}

// Local storage fallback keys
function saveSettingsToLocal(settings) {
  localStorage.setItem('sd_st_key_settings', JSON.stringify(settings));
  status('Saved to localStorage');
}

function loadSettingsFromLocal() {
  const raw = localStorage.getItem('sd_st_key_settings');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    loadSettingsIntoUI(s);
    status('Loaded settings from localStorage');
  } catch (e) { /* ignore */ }
}

function loadSettingsIntoUI(s) {
  // s shape: { type, device_id, scene_id, group_device_ids, command, level, smartthings_pat }
  if (s.smartthings_pat) patInput.value = s.smartthings_pat;
  if (s.type) targetType.value = s.type;
  // populate UI segments accordingly; devices list may not yet be loaded
  if (s.device_id) deviceSelect.value = s.device_id;
  if (s.scene_id) sceneSelect.value = s.scene_id;
  if (Array.isArray(s.group_device_ids)) {
    // We'll re-select after devices are loaded
    const existing = s.group_device_ids;
    setTimeout(() => {
      for (const opt of groupDevices.options) {
        opt.selected = existing.includes(opt.value);
      }
    }, 250);
  }
  if (s.command) {
    deviceCommand.value = s.command;
    groupCommand.value = s.command;
  }
  if (s.level) {
    deviceLevel.value = s.level;
    groupLevel.value = s.level;
  }
  updateSections();
}

// UI updates visibility
function updateSections() {
  const t = targetType.value;
  deviceSection.style.display = t === 'device' ? 'block' : 'none';
  sceneSection.style.display = t === 'scene' ? 'block' : 'none';
  groupSection.style.display = t === 'group' ? 'block' : 'none';
}

// Fill device select lists
function populateDevices(list) {
  deviceSelect.innerHTML = '<option value="">(no device)</option>';
  groupDevices.innerHTML = '';
  list.forEach(d => {
    const label = d.label || d.name || d.deviceId;
    const opt1 = document.createElement('option');
    opt1.value = d.deviceId;
    opt1.textContent = `${label} — ${d.deviceId}`;
    deviceSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = d.deviceId;
    opt2.textContent = `${label} — ${d.deviceId}`;
    groupDevices.appendChild(opt2);
  });
}

// Fill scenes
function populateScenes(list) {
  sceneSelect.innerHTML = '<option value="">(no scene)</option>';
  list.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.sceneId;
    opt.textContent = `${s.name || s.sceneId} — ${s.sceneId}`;
    sceneSelect.appendChild(opt);
  });
}

async function doLoadDevices() {
  const token = patInput.value.trim();
  if (!token) return alert('Paste SmartThings PAT first');
  loadDevicesBtn.disabled = true;
  loadDevicesBtn.textContent = 'Loading…';
  try {
    const devices = await ST.listDevices(token);
    populateDevices(devices);
    status('Loaded devices');
  } catch (e) {
    alert('Failed to load devices: ' + e.message);
  } finally {
    loadDevicesBtn.disabled = false;
    loadDevicesBtn.textContent = 'Load devices';
  }
}

async function doLoadScenes() {
  const token = patInput.value.trim();
  if (!token) return alert('Paste SmartThings PAT first');
  loadScenesBtn.disabled = true;
  loadScenesBtn.textContent = 'Loading…';
  try {
    const scenes = await ST.listScenes(token);
    populateScenes(scenes);
    status('Loaded scenes');
  } catch (e) {
    alert('Failed to load scenes: ' + e.message);
  } finally {
    loadScenesBtn.disabled = false;
    loadScenesBtn.textContent = 'Load scenes';
  }
}

// Save global PAT
function saveGlobalPat() {
  const pat = patInput.value.trim();
  if (!pat) return alert('Enter PAT');
  if (!websocket) {
    // fallback to localStorage
    localStorage.setItem('sd_st_global_pat', pat);
    status('Saved global PAT to localStorage');
    return;
  }
  const payload = {
    event: 'setGlobalSettings',
    uuid: uuid,
    payload: { settings: { smartthings_pat: pat } }
  };
  websocket.send(JSON.stringify(payload));
  status('Saved global PAT');
}

// Save per-key settings
function saveKeySettings() {
  const type = targetType.value;
  const settings = { type };

  if (type === 'device') {
    settings.device_id = deviceSelect.value || '';
    settings.command = deviceCommand.value;
    if (deviceCommand.value === 'setLevel') settings.level = Number(deviceLevel.value) || 100;
  } else if (type === 'scene') {
    settings.scene_id = sceneSelect.value || '';
  } else if (type === 'group') {
    const selected = Array.from(groupDevices.selectedOptions).map(o => o.value);
    settings.group_device_ids = selected;
    settings.command = groupCommand.value;
    if (groupCommand.value === 'setLevel') settings.level = Number(groupLevel.value) || 100;
  }

  // include PAT in settings optionally (useful if you prefer per-key PAT)
  // We'll avoid storing PAT per key; user requested global PAT, but we keep it if provided:
  // settings.smartthings_pat = patInput.value.trim();

  if (!websocket) {
    // fallback
    saveSettingsToLocal(settings);
    return;
  }
  // Use setSettings to persist per-key settings
  const msg = {
    event: 'setSettings',
    context: uuid,
    payload: settings
  };
  websocket.send(JSON.stringify(msg));
  status('Saved settings to Stream Deck host');
}

// Wire events
targetType.addEventListener('change', updateSections);
loadDevicesBtn.addEventListener('click', doLoadDevices);
loadScenesBtn.addEventListener('click', doLoadScenes);
savePatBtn.addEventListener('click', saveGlobalPat);
saveSettingsBtn.addEventListener('click', saveKeySettings);

deviceCommand.addEventListener('change', () => {
  const v = deviceCommand.value;
  if (v === 'setLevel') { deviceLevel.style.display = 'block'; deviceLevelLabel.style.display = 'block'; }
  else { deviceLevel.style.display = 'none'; deviceLevelLabel.style.display = 'none'; }
});
groupCommand.addEventListener('change', () => {
  const v = groupCommand.value;
  if (v === 'setLevel') { groupLevel.style.display = 'block'; groupLevelLabel.style.display = 'block'; }
  else { groupLevel.style.display = 'none'; groupLevelLabel.style.display = 'none'; }
});

// Initial connection & UI
connect();
updateSections();

// Try to populate devices/scenes from local storage if present
(function initFromLocal() {
  const gpat = localStorage.getItem('sd_st_global_pat');
  if (gpat && !patInput.value) patInput.value = gpat;
  const rawDevices = localStorage.getItem('sd_st_cached_devices');
  if (rawDevices) {
    try {
      const devs = JSON.parse(rawDevices);
      populateDevices(devs);
    } catch(e){}
  }
})();
