export async function listDevices(token) {
  const res = await fetch('https://api.smartthings.com/v1/devices', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`listDevices failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

export async function listScenes(token) {
  const res = await fetch('https://api.smartthings.com/v1/scenes', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`listScenes failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

export async function executeScene(token, sceneId) {
  const res = await fetch(`https://api.smartthings.com/v1/scenes/${encodeURIComponent(sceneId)}/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`executeScene failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

export async function getDeviceStatus(token, deviceId) {
  const res = await fetch(`https://api.smartthings.com/v1/devices/${encodeURIComponent(deviceId)}/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getDeviceStatus failed: ${res.status}`);
  return await res.json();
}

export function extractSwitchValue(statusObj) {
  try { return statusObj.components.main.capabilities.switch.switch.value; }
  catch (e) { return null; }
}

export async function getSwitchState(token, deviceId) {
  const status = await getDeviceStatus(token, deviceId);
  return extractSwitchValue(status);
}

export async function sendCommand(token, deviceId, capability, command, args = []) {
  const body = { commands: [{ component: "main", capability, command, arguments: args }] };
  const res = await fetch(`https://api.smartthings.com/v1/devices/${encodeURIComponent(deviceId)}/commands`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sendCommand failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

export async function sendUniformCommandToDevices(token, deviceIds, capability, command, args = []) {
  for (const id of deviceIds) {
    await sendCommand(token, id, capability, command, args);
  }
  return true;
}

export async function getSwitchStatesForDevices(token, deviceIds) {
  const out = [];
  for (const id of deviceIds) {
    try { out.push({ deviceId: id, state: await getSwitchState(token, id) }); }
    catch (e) { out.push({ deviceId: id, state: null }); }
  }
  return out;
}