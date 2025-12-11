async function listDevices(token) {
    const res = await fetch('https://api.smartthings.com/v1/devices', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok)
        throw new Error(`listDevices failed: ${res.status}`);
    const data = await res.json();
    return data.items || [];
}
async function listScenes(token) {
    const res = await fetch('https://api.smartthings.com/v1/scenes', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok)
        throw new Error(`listScenes failed: ${res.status}`);
    const data = await res.json();
    return data.items || [];
}

const $ = (sel) => document.querySelector(sel);
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
let uuid = null;
function parseQuery() {
    const q = {};
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of params.entries())
        q[k] = v;
    return q;
}
function connectPI() {
    const q = parseQuery();
    const port = q.port;
    uuid = q.uuid || q.pluginUUID || q.context || null;
    if (!port) {
        status('Dev mode (no host).');
        loadSettingsFromLocal();
        return;
    }
    websocket = new WebSocket(`ws://127.0.0.1:${port}`);
    websocket.onopen = () => {
        websocket.send(JSON.stringify({ event: "registerPropertyInspector", uuid }));
        status('PI registered');
        websocket.send(JSON.stringify({ event: "getGlobalSettings", context: uuid }));
    };
    websocket.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        const { event, payload } = msg;
        if (event === 'didReceiveSettings' && payload?.settings) {
            loadSettingsIntoUI(payload.settings);
        }
        else if (event === 'didReceiveGlobalSettings' && payload?.settings) {
            if (payload.settings.smartthings_pat)
                patInput.value = payload.settings.smartthings_pat;
        }
    };
}
function status(t) { statusEl.textContent = t; }
function saveGlobalPat() {
    const pat = patInput.value.trim();
    if (!pat) {
        alert('Enter PAT');
        return;
    }
    if (!websocket) {
        localStorage.setItem('sd_st_global_pat', pat);
        status('Saved PAT (local)');
        return;
    }
    websocket.send(JSON.stringify({ event: 'setGlobalSettings', context: uuid, payload: { settings: { smartthings_pat: pat } } }));
    status('Saved PAT');
}
function saveKeySettings() {
    const type = targetType.value;
    const settings = { type };
    if (type === 'device') {
        settings.device_id = deviceSelect.value || '';
        settings.command = deviceCommand.value;
        if (deviceCommand.value === 'setLevel')
            settings.level = Number(deviceLevel.value) || 100;
    }
    else if (type === 'scene') {
        settings.scene_id = sceneSelect.value || '';
    }
    else if (type === 'group') {
        const selected = Array.from(groupDevices.selectedOptions).map(o => o.value);
        settings.group_device_ids = selected;
        settings.command = groupCommand.value;
        if (groupCommand.value === 'setLevel')
            settings.level = Number(groupLevel.value) || 100;
    }
    if (!websocket) {
        localStorage.setItem('sd_st_key_settings', JSON.stringify(settings));
        status('Saved settings (local)');
        return;
    }
    websocket.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: settings }));
    status('Saved key settings');
}
function loadSettingsFromLocal() {
    try {
        const s = JSON.parse(localStorage.getItem('sd_st_key_settings') || '{}');
        loadSettingsIntoUI(s);
    }
    catch { }
}
function loadSettingsIntoUI(s) {
    if (s.smartthings_pat)
        patInput.value = s.smartthings_pat;
    if (s.type)
        targetType.value = s.type;
    if (s.device_id)
        deviceSelect.value = s.device_id;
    if (s.scene_id)
        sceneSelect.value = s.scene_id;
    if (Array.isArray(s.group_device_ids)) {
        setTimeout(() => {
            for (const opt of Array.from(groupDevices.options))
                opt.selected = s.group_device_ids.includes(opt.value);
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
function updateSections() {
    const t = targetType.value;
    deviceSection.style.display = t === 'device' ? 'block' : 'none';
    sceneSection.style.display = t === 'scene' ? 'block' : 'none';
    groupSection.style.display = t === 'group' ? 'block' : 'none';
    const devSetLevel = (deviceCommand.value === 'setLevel');
    deviceLevel.style.display = devSetLevel ? 'block' : 'none';
    deviceLevelLabel.style.display = devSetLevel ? 'block' : 'none';
    const grpSetLevel = (groupCommand.value === 'setLevel');
    groupLevel.style.display = grpSetLevel ? 'block' : 'none';
    groupLevelLabel.style.display = grpSetLevel ? 'block' : 'none';
}
loadDevicesBtn.addEventListener('click', async () => {
    const token = patInput.value.trim();
    if (!token)
        return alert('Paste PAT first');
    try {
        const devices = await listDevices(token);
        deviceSelect.innerHTML = '<option value="">(no device)</option>';
        groupDevices.innerHTML = '';
        devices.forEach((d) => {
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
        status('Loaded devices');
    }
    catch (e) {
        alert('Failed to load devices: ' + e.message);
    }
});
loadScenesBtn.addEventListener('click', async () => {
    const token = patInput.value.trim();
    if (!token)
        return alert('Paste PAT first');
    try {
        const scenes = await listScenes(token);
        sceneSelect.innerHTML = '<option value="">(no scene)</option>';
        scenes.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s.sceneId;
            opt.textContent = `${s.name || s.sceneId} — ${s.sceneId}`;
            sceneSelect.appendChild(opt);
        });
        status('Loaded scenes');
    }
    catch (e) {
        alert('Failed to load scenes: ' + e.message);
    }
});
savePatBtn.addEventListener('click', saveGlobalPat);
saveSettingsBtn.addEventListener('click', saveKeySettings);
connectPI();
updateSections();
