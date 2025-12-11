(function(){
  let ws=null, piUUID=null, actionUUID=null, actionContext=null;

  function $(id){ return document.getElementById(id); }
  function send(msg){ if(ws) ws.send(JSON.stringify(msg)); }
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
          $('sceneId').value = s.sceneId || '';
        }
      }
    };

    function save(){ sendToPlugin({ cmd: 'saveSettings', settings: { sceneId: $('sceneId').value } }); }

    $('savePat').addEventListener('click', function(){
      const pat = ($('pat').value || '').trim();
      if (!pat) { alert('Enter a PAT first'); return; }
      sendToPlugin({ cmd: 'savePat', pat });
      alert('PAT saved.');
    });

    $('sceneId').addEventListener('change', save);

    $('loadScenes').addEventListener('click', async ()=>{
      const pat = ($('pat').value || '').trim();
      if (!pat) return alert('Enter PAT and Save first');
      try {
        const res = await stFetch(pat, 'https://api.smartthings.com/v1/scenes');
        const items = Array.isArray(res.items) ? res.items : [];
        const el = $('sceneId'); el.innerHTML = '';
        items.forEach(s=>{
          const opt = document.createElement('option');
          opt.value = s.sceneId;
          opt.textContent = s.sceneName || s.name || s.sceneId;
          el.appendChild(opt);
        });
        save();
      } catch(e) {
        alert('Failed to load scenes: ' + (e.message || e));
      }
    });
  };
})();