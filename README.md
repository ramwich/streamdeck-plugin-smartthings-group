# Stream Deck — SmartThings Plugin (group support)

This Stream Deck plugin lets you control SmartThings devices, scenes, or plugin-defined groups (multi-device).

Features:
- Global SmartThings PAT (enter once)
- Per-key target: device, scene, or group (group = select multiple devices)
- Uniform group commands (on/off/set level) and group toggle behavior:
  - If group command is "toggle": if any device in the group is ON, the plugin will turn everything OFF; otherwise it turns everything ON.
- Per-key settings persisted to the Stream Deck host (setSettings); PAT persisted as global settings (setGlobalSettings).

Quick setup:
1. Create a SmartThings Personal Access Token (PAT) with appropriate scopes (r:devices, w:devices, r:scenes, w:scenes).
2. Install/load the plugin in Stream Deck (developer mode).
3. Add "SmartThings Control" to a key. Open the Property Inspector for the key and paste your PAT once. Click "Load devices" and/or "Load scenes".
4. For a key:
   - Choose target type: Device / Scene / Group.
   - If Device: pick device and command.
   - If Group: multi-select devices, choose command (on/off/toggle/set level).
   - Save — settings are persisted per-key.
5. Press the key to run the command.

Notes:
- Uses SmartThings REST API: /v1/devices, /v1/devices/{id}/status, /v1/devices/{id}/commands, /v1/scenes, /v1/scenes/{id}/execute
- Group is a plugin-side group (i.e., a list of device IDs saved in that key's settings).
- Property Inspector communicates with Stream Deck host (setSettings / setGlobalSettings). Falls back to localStorage if host connection is not present (development).
