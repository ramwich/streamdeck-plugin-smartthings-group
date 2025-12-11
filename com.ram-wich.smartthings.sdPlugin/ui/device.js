(function(){
  let ws=null, piUUID=null, actionUUID=null, actionContext=null;

  function $(id){ return document.getElementById(id); }
  function send(msg){ if(ws) ws.send(JSON.stringify(msg)); }
  // IMPORTANT: context must be the PI UUID; include actionContext in payload
  function sendToPlugin(payload){ send({ event:'sendToPlugin', action: actionUUID, context: piUUID, payload: Object.assign({ actionContext }, payload) }); }

  async function stFetch(pat, url){
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  }

  window.connectElgatoStreamDeckSocket = function(){
    const [inPort, inUUID, inRegisterEvent, inInfo, arg5, arg6] = arguments;
    piUUID = inUUID;

    if (typeof arg6 === 'string') { actionUUID = arg5; actionContext = arg6; }
    else { try { const info = JSON.parse(arg5 || '{}'); actionUUID = info.action; actionContext = info.context; } catch { actionUUID=''; actionContext=''; } }

    ws = new WebSocket(`ws://localhost:${inPort}`);
    ws.onopen = function(){
      send({ event: inRegisterEvent, uuid: piUUID });
      sendToPlugin({ cmd: 'piReady' });
    };
    ws.onmessage = function(evt){
      let m; try{ m = JSON.parse(evt.data); }catch{ return; }
      if (m.event === 'sendToPropertyInspector' && m.context === actionContext) {
        const p = m.payload || {};
        if (p.type === 'settings') {
          const s = p.settings || {};
          if (p.pat && !$('pat').value) $('pat').value = p.pat;
          $('deviceId').value = s.deviceId || '';
          $('command').value  = s.command  || 'toggle';
          $('level').value    = s.level != null ? s.level : 50;
        }
      }
    };

    function save(){
      const settings = {
        deviceId: $('deviceId').value,
        command: $('command').value,
        level: Number($('level').value)
      };
      sendToPlugin({ cmd: 'saveSettings', settings });
    }

    $('savePat').addEventListener('click', function(){
      const pat = ($('pat').value || '').trim();
      if (!pat) { alert('Enter a PAT first'); return; }
      sendToPlugin({ cmd: 'savePat', pat });
      alert('PAT saved.');
    });

    ['deviceId','command','level'].forEach(id => $(id).addEventListener('change', save));
    $('level').addEventListener('input', save);

    $('loadDevices').addEventListener('click', async ()=>{
      const pat = ($('pat').value || '').trim();
      if (!pat) return alert('Enter PAT and Save first');
      try {
        const res = await stFetch(pat, 'https://api.smartthings.com/v1/devices');
        const items = Array.isArray(res.items) ? res.items : [];
        const el = $('deviceId'); el.innerHTML = '';
        items.forEach(d=>{
          const opt = document.createElement('option');
          opt.value = d.deviceId;
          opt.textContent = d.label || d.name || d.deviceId;
          el.appendChild(opt);
        });
        save();
      } catch(e) {
        alert('Failed to load devices: ' + (e.message || e));
      }
    });
  };
})();