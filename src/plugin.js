import * as ST from './smartthings.js';

let websocket = null;
let uuid = null;
let globalSettings = {};

window.connectElgatoStreamDeckSocket = function(inPort, inUUID, inRegisterEvent) {
  uuid = inUUID;
  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    websocket.send(JSON.stringify({ event: 'getGlobalSettings', context: inUUID }));
  };

  websocket.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);
    const { event, action, context, payload } = msg;

    if (event === 'didReceiveGlobalSettings') {
      globalSettings = (payload && payload.settings) ? payload.settings : {};
    } else if ((event === 'willAppear' || event === 'didReceiveSettings') && action === 'com.ramwich.smartthings.control') {
      const s = (msg.payload && msg.payload.settings) ? msg.payload.settings : {};
      await refreshStateForContext(context, s);
    } else if (event === 'keyDown' && action === 'com.ramwich.smartthings.control') {
      await handleKeyDown(context, msg.payload);
    }
  };
};

async function handleKeyDown(context, messagePayload) {
  const s = (messagePayload && messagePayload.settings) ? messagePayload.settings :
            (messagePayload && messagePayload.payload && messagePayload.payload.settings ? messagePayload.payload.settings : {});
  try {
    const token = s.smartthings_pat || globalSettings.smartthings_pat;
    if (!token) { sendTitle(context, 'Configure\\nPAT'); return; }

    const type = s.type || 'device';
    if (type === 'scene') {
      const sceneId = s.scene_id;
      if (!sceneId) { sendTitle(context, 'No scene'); return; }
      sendTitle(context, 'Running...');
      await ST.executeScene(token, sceneId);
      sendTitle(context, 'Ran');
      setTimeout(() => refreshStateForContext(context, s), 800);
      return;
    }

    if (type === 'device') {
      const deviceId = s.device_id;
      if (!deviceId) { sendTitle(context, 'No device'); return; }
      const cmd = s.command || 'toggle';
      await handleDeviceCommand(token, context, deviceId, cmd, s.level);
      return;
    }

    if (type === 'group') {
      const deviceIds = s.group_device_ids || [];
      if (!deviceIds.length) { sendTitle(context, 'No devices'); return; }
      const cmd = s.command || 'toggle';
      await handleGroupCommand(token, context, deviceIds, cmd, s.level);
      return;
    }
  } catch (err) {
    console.error('keyDown error', err);
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
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId, type: 'device' }), 800);
    } else if (cmd === 'on' || cmd === 'off') {
      sendTitle(context, cmd.toUpperCase());
      await ST.sendCommand(token, deviceId, 'switch', cmd);
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId, type: 'device' }), 800);
    } else if (cmd === 'setLevel') {
      const lvl = Number(level) || 100;
      sendTitle(context, `L:${lvl}`);
      await ST.sendCommand(token, deviceId, 'switchLevel', 'setLevel', [lvl]);
      setTimeout(() => refreshStateForContext(context, { device_id: deviceId, type: 'device' }), 800);
    }
  } catch (err) {
    console.error('handleDeviceCommand', err);
    sendTitle(context, 'Err');
  }
}

async function handleGroupCommand(token, context, deviceIds, cmd, level) {
  try {
    if (cmd === 'toggle') {
      const states = await ST.getSwitchStatesForDevices(token, deviceIds);
      const anyOn = states.some(s => s.state === 'on');
      if (anyOn) {
        sendTitle(context, 'ALL OFF');
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'off');
      } else {
        sendTitle(context, 'ALL ON');
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'on');
      }
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds, type: 'group' }), 1000);
    } else if (cmd === 'on' || cmd === 'off') {
      sendTitle(context, cmd.toUpperCase());
      await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', cmd);
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds, type: 'group' }), 1000);
    } else if (cmd === 'setLevel') {
      const lvl = Number(level) || 100;
      sendTitle(context, `L:${lvl}`);
      await ST.sendUniformCommandToDevices(token, deviceIds, 'switchLevel', 'setLevel', [lvl]);
      setTimeout(() => refreshStateForContext(context, { group_device_ids: deviceIds, type: 'group' }), 1000);
    }
  } catch (err) {
    console.error('handleGroupCommand', err);
    sendTitle(context, 'Err');
  }
}

async function refreshStateForContext(context, settings) {
  try {
    const token = (settings && settings.smartthings_pat) || globalSettings.smartthings_pat;
    if (!token) { sendTitle(context, 'Configure\\nPAT'); return; }
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
    if (type === 'scene') { sendTitle(context, 'SCENE'); return; }
  } catch (err) {
    console.error('refreshStateForContext', err);
    sendTitle(context, 'Err');
  }
}

function sendTitle(context, title) {
  if (!websocket) return;
  websocket.send(JSON.stringify({ event: 'setTitle', context, payload: { title } }));
}