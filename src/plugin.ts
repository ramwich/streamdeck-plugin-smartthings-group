import { SmartThingsControl } from './actions/smartthings-control';

declare global {
  interface Window { connectElgatoStreamDeckSocket: any; }
}

let websocket: WebSocket | null = null;
let uuid: string | null = null;
let globalSettings: any = {};

const action = new SmartThingsControl();

(window as any).connectElgatoStreamDeckSocket = function(inPort: number, inUUID: string, inRegisterEvent: string) {
  uuid = inUUID;
  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket!.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    websocket!.send(JSON.stringify({ event: 'getGlobalSettings', context: inUUID }));
  };

  websocket.onmessage = async (evt: MessageEvent) => {
    const msg = JSON.parse(evt.data as string);
    const { event, action: act, context, payload } = msg;

    if (event === 'didReceiveGlobalSettings') {
      globalSettings = (payload && payload.settings) ? payload.settings : {};
    } else if ((event === 'willAppear' || event === 'didReceiveSettings') && act === 'com.ramwich.smartthings.control') {
      const s = (msg.payload && msg.payload.settings) ? msg.payload.settings : {};
      await action.refresh(websocket!, context, s, globalSettings);
    } else if (event === 'keyDown' && act === 'com.ramwich.smartthings.control') {
      await action.keyDown(websocket!, context, (msg.payload || {}).settings || {}, globalSettings);
    }
  };
};