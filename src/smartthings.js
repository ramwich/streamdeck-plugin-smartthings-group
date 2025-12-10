// Minimal SmartThings API helper.
// Requires fetch (browser/Node with global fetch).
// All functions throw on non-OK responses.

export async function listDevices(token) {
  const res = await fetch('https://api.smartthings.com/v1/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`listDevices failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

export async function listScenes(token) {
  const res = await fetch('https://api.smartthings.com/v1/scenes', {
    headers: { Authorization: `Bearer ${token}` }
  });
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
  const data = await res.json();
  return data;
}

// Returns 'on'|'off'|null if switch attribute exists; otherwise null
export function extractSwitchValue(statusObj) {
  try {
    const val = statusObj.components.main.capabilities.switch.switch.value;
    return val; // 'on' or 'off'
  } catch (e) {
    return null;
  }
}

export async function getSwitchState(token, deviceId) {
  const status = await getDeviceStatus(token, deviceId);
  return extractSwitchValue(status); // may be 'on'/'off'/null
}

// Send a command to a device. capability e.g. 'switch', command e.g. 'on'/'off'.
// For setLevel use capability 'switchLevel' and command 'setLevel' with args [level]
export async function sendCommand(token, deviceId, capability, command, args = []) {
  const body = {
    commands: [
      {
        component: "main",
        capability: capability,
        command: command,
        arguments: args
      }
    ]
  };
  const res = await fetch(`https://api.smartthings.com/v1/devices/${encodeURIComponent(deviceId)}/commands`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sendCommand failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

// Send uniform on/off to many deviceIds. capability is 'switch' for on/off.
// For setLevel use capability 'switchLevel' and pass args = [level].
export async function sendUniformCommandToDevices(token, deviceIds, capability, command, args = []) {
  // Run sequentially to avoid rate-limiting spikes; could be parallelized if you'd prefer.
  for (const id of deviceIds) {
    await sendCommand(token, id, capability, command, args);
  }
  return true;
}

// Get switch states for each device id. Returns array of { deviceId, state } where state is 'on'|'off'|null
export async function getSwitchStatesForDevices(token, deviceIds) {
  const out = [];
  for (const id of deviceIds) {
    try {
      const st = await getSwitchState(token, id);
      out.push({ deviceId: id, state: st });
    } catch (e) {
      out.push({ deviceId: id, state: null });
    }
  }
  return out;
}
