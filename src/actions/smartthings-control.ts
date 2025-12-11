import * as ST from '../smartthings';

export class SmartThingsControl {
  async keyDown(ws: WebSocket, context: string, settings: any, global: any) {
    try {
      const token = settings.smartthings_pat || global.smartthings_pat;
      if (!token) return this.setTitle(ws, context, 'Configure\\nPAT');

      const type = settings.type || 'device';
      if (type === 'scene') {
        const sceneId = settings.scene_id;
        if (!sceneId) return this.setTitle(ws, context, 'No scene');
        this.setTitle(ws, context, 'Running...');
        await ST.executeScene(token, sceneId);
        this.setTitle(ws, context, 'Ran');
        setTimeout(() => this.refresh(ws, context, settings, global), 800);
        return;
      }

      if (type === 'device') {
        const deviceId = settings.device_id;
        if (!deviceId) return this.setTitle(ws, context, 'No device');
        const cmd = settings.command || 'toggle';
        await this.deviceCommand(ws, token, context, deviceId, cmd, settings.level);
        return;
      }

      if (type === 'group') {
        const deviceIds: string[] = settings.group_device_ids || [];
        if (!deviceIds.length) return this.setTitle(ws, context, 'No devices');
        const cmd = settings.command || 'toggle';
        await this.groupCommand(ws, token, context, deviceIds, cmd, settings.level);
        return;
      }
    } catch (e) {
      console.error('keyDown', e);
      this.setTitle(ws, context, 'Err');
    }
  }

  async deviceCommand(ws: WebSocket, token: string, context: string, deviceId: string, cmd: string, level?: number) {
    try {
      if (cmd === 'toggle') {
        const state = await ST.getSwitchState(token, deviceId);
        const target = state === 'on' ? 'off' : 'on';
        this.setTitle(ws, context, target.toUpperCase());
        await ST.sendCommand(token, deviceId, 'switch', target);
        setTimeout(() => this.refresh(ws, context, { device_id: deviceId, type: 'device' }, {}), 800);
      } else if (cmd === 'on' || cmd === 'off') {
        this.setTitle(ws, context, cmd.toUpperCase());
        await ST.sendCommand(token, deviceId, 'switch', cmd);
        setTimeout(() => this.refresh(ws, context, { device_id: deviceId, type: 'device' }, {}), 800);
      } else if (cmd === 'setLevel') {
        const lvl = Number(level) || 100;
        this.setTitle(ws, context, `L:${lvl}`);
        await ST.sendCommand(token, deviceId, 'switchLevel', 'setLevel', [lvl]);
        setTimeout(() => this.refresh(ws, context, { device_id: deviceId, type: 'device' }, {}), 800);
      }
    } catch (e) {
      console.error('deviceCommand', e);
      this.setTitle(ws, context, 'Err');
    }
  }

  async groupCommand(ws: WebSocket, token: string, context: string, deviceIds: string[], cmd: string, level?: number) {
    try {
      if (cmd === 'toggle') {
        const states = await ST.getSwitchStatesForDevices(token, deviceIds);
        const anyOn = states.some(s => s.state === 'on');
        if (anyOn) {
          this.setTitle(ws, context, 'ALL OFF');
          await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'off');
        } else {
          this.setTitle(ws, context, 'ALL ON');
          await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', 'on');
        }
        setTimeout(() => this.refresh(ws, context, { group_device_ids: deviceIds, type: 'group' }, {}), 1000);
      } else if (cmd === 'on' || cmd === 'off') {
        this.setTitle(ws, context, cmd.toUpperCase());
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switch', cmd);
        setTimeout(() => this.refresh(ws, context, { group_device_ids: deviceIds, type: 'group' }, {}), 1000);
      } else if (cmd === 'setLevel') {
        const lvl = Number(level) || 100;
        this.setTitle(ws, context, `L:${lvl}`);
        await ST.sendUniformCommandToDevices(token, deviceIds, 'switchLevel', 'setLevel', [lvl]);
        setTimeout(() => this.refresh(ws, context, { group_device_ids: deviceIds, type: 'group' }, {}), 1000);
      }
    } catch (e) {
      console.error('groupCommand', e);
      this.setTitle(ws, context, 'Err');
    }
  }

  async refresh(ws: WebSocket, context: string, settings: any, global: any) {
    try {
      const token = (settings && settings.smartthings_pat) || (global && global.smartthings_pat);
      if (!token) return this.setTitle(ws, context, 'Configure\\nPAT');
      const type = settings.type || 'device';
      if (type === 'device') {
        const deviceId = settings.device_id;
        if (!deviceId) return this.setTitle(ws, context, 'No device');
        const state = await ST.getSwitchState(token, deviceId);
        if (state === 'on') this.setTitle(ws, context, 'ON');
        else if (state === 'off') this.setTitle(ws, context, 'OFF');
        else this.setTitle(ws, context, 'N/A');
        return;
      }
      if (type === 'group') {
        const deviceIds: string[] = settings.group_device_ids || [];
        if (!deviceIds.length) return this.setTitle(ws, context, 'No devices');
        const states = await ST.getSwitchStatesForDevices(token, deviceIds);
        const anyOn = states.some(s => s.state === 'on');
        this.setTitle(ws, context, anyOn ? 'SOME ON' : 'ALL OFF');
        return;
      }
      if (type === 'scene') return this.setTitle(ws, context, 'SCENE');
    } catch (e) {
      console.error('refresh', e);
      this.setTitle(ws, context, 'Err');
    }
  }

  setTitle(ws: WebSocket, context: string, title: string) {
    ws.send(JSON.stringify({ event: 'setTitle', context, payload: { title } }));
  }
}