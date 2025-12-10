// Stream Deck WebSocket plugin runtime
// Handles per-key settings and global PAT. Supports device/scene/group targets.

import * as ST from './smartthings.js';

let websocket = null;
let uuid = null;
let globalSettings = {}; // will hold { smartthings_pat: "..." }

function connect(inPort, inUUID, inRegisterEvent, inInfo) {
  uuid = inUUID;
  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    const json = {
      event: inRegisterEvent,
      uuid: inUUID
    };
    websocket.send(JSON.stringify(json));
  };

  websocket.onmessage = async (evt) => {
    const message = JSON.parse(evt.data);
    const { event, action, context, payload } = message;

    if (event === 'keyDown' && action === 'com.ramwich.smartthings.control') {
      await handleKeyDown(context, payload);
    } else if ((event === 'willAppear' || event === 'didReceiveSettings') && action === 'com.ramwich.smartthings.control') {
      // refresh UI for this context with saved settings
      await refreshStateForContext(context, message.payload && message.payload.settings ? message.payload.settings : {});
    } else if (event === 'didReceiveGlobalSettings') {
      globalSettings = (payload && payload.settings) ? payload.settings : {};
    }
  };
}

async function handleKeyDown(context, messagePayload) {
  // messagePayload.payload.settings is usually where settings live
  const settings = messagePayload && messagePayload.settings ? messagePayload.settings : (messagePayload && messagePayload.payload && messagePayload.payload.settings ? messagePayload.payload.settings : {});
  // fallback to context settings via request? We'll assume settings are present in payload as Stream Deck does.
  try {
    const token = settings.smartthings_pat || globalSettings.smartthings_pat;
    if (!token) {
      sendTitle(context, 'Configure\\nPAT');
      return;
    }
    const type = settings.type || 'device'; // device|scene|group
    if (type === 'scene') {
      const sceneId = settings.scene_id;
      if (!sceneId) {
        sendTitle(context, 'No scene');
        return;
      }
      sendTitle(context, 'Running...');
      await ST.executeScene(token, sceneId);
      sendTitle(context, 'Ran');
      setTimeout(() => refreshStateForContext(context, settings), 800);
      return;
    }

    if (type === 'device') {
      const deviceId = settings.device_id;
      if (!deviceId) {
        sendTitle(context, 'No device');
        return;
      }
      const cmd = settings.command || 'toggle'; // toggle|on|off|setLevel
      await handleDeviceCommand(token, context, deviceId, cmd, settings.level);
      return;
    }

    if (type === 'group') {
      const deviceIds = settings.group_device_ids || [];
      if (!deviceIds.length) {
        sendTitle(context, 'No devices');
        return;
      }
      const cmd = settings.command || 'toggle'; // toggle|on|off|setLevel
      await handleGroupCommand(token, context, deviceIds, cmd, settings.level);
      return;
    }
  } catch (err) {
    console.error('handleKeyDown error', err);
    sendTitle(context, 'Err');
  }
}

async function handleDeviceCommand(token, context, deviceId, cmd, level) {
  try {
    if (cmd === 'toggle') {
      const state = await ST.getSwitchState(token, deviceId);
      const target = state === 'on' ? 'off' : 'on';
      sendTitle(context, target.toUpperCase());
      await ST.sendCommand(token, deviceId, 'switch', target);
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId }), 800);
    } else if (cmd === 'on' || cmd === 'off') {
      sendTitle(context, cmd.toUpperCase());
      await ST.sendCommand(token, deviceId, 'switch', cmd);
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId }), 800);
    } else if (cmd === 'setLevel') {
      const lvl = Number(level) || 100;
      sendTitle(context, `L:${lvl}`);
      await ST.sendCommand(token, deviceId, 'switchLevel', 'setLevel', [lvl]);
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId }), 800);
    }
  } catch (err) {
    console.error('handleDeviceCommand', err);
    sendTitle(context, 'Err');
  }
}

async function handleGroupCommand(token, context, deviceIds, cmd, level) {
  try {
    if (cmd === 'toggle') {
      // Read states for all devices; if any 'on', then turn everything off; else turn everything on
      const states = await ST.getSwitchStatesForDevices(token, deviceIds);
      const anyOn = states.some(s => s.state === 'on');
      if (anyOn) {
        sendTitle(context, 'ALL OFF');
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'off');
      } else {
        sendTitle(context, 'ALL ON');
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'on');
      }
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds }), 1000);
    } else if (cmd === 'on' || cmd === 'off') {
      sendTitle(context, cmd.toUpperCase());
      await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', cmd);
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds }), 1000);
    } else if (cmd === 'setLevel') {
      const lvl = Number(level) || 100;
      sendTitle(context, `L:${lvl}`);
      await ST.sendUniformCommandToDevices(token, deviceIds, 'switchLevel', 'setLevel', [lvl]);
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds }), 1000);
    }
  } catch (err) {
    console.error('handleGroupCommand', err);
    sendTitle(context, 'Err');
  }
}

async function refreshStateForContext(context, settings) {
  try {
    const token = (settings && settings.smartthings_pat) || globalSettings.smartthings_pat;
    if (!token) {
      sendTitle(context, 'Configure\\nPAT');
      return;
    }
    const type = settings.type || 'device';
    if (type === 'device') {
      const deviceId = settings.device_id;
      if (!deviceId) { sendTitle(context, 'No device'); return; }
      const state = await ST.getSwitchState(token, deviceId);
      if (state === 'on') sendTitle(context, 'ON');
      else if (state === 'off') sendTitle(context, 'OFF');
      else sendTitle(context, 'N/A');
      return;
    }
    if (type === 'group') {
      const deviceIds = settings.group_device_ids || [];
      if (!deviceIds.length) { sendTitle(context, 'No devices'); return; }
      const states = await ST.getSwitchStatesForDevices(token, deviceIds);
      const anyOn = states.some(s => s.state === 'on');
      sendTitle(context, anyOn ? 'SOME ON' : 'ALL OFF');
      return;
    }
    if (type === 'scene') {
      sendTitle(context, 'SCENE');
      return;
    }
  } catch (err) {
    console.error('refreshStateForContext', err);
    sendTitle(context, 'Err');
  }
}

function sendTitle(context, title) {
  if (!websocket) return;
  const payload = {
    event: 'setTitle',
    context: context,
    payload: { title: title }
  };
  websocket.send(JSON.stringify(payload));
}

// Expose connect for Stream Deck to call
window.connectElgatoStreamDeckSocket = connect;
