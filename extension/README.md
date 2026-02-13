# DeepSave Pro Chrome Extension

## Load unpacked
1. Open `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `extension/` folder.

## Configure
1. Open the extension popup.
2. Click the settings icon (top right).
3. Set `API URL` (example: `http://10.222.77.138:8356`).
4. Paste the `Access Token` generated from `/settings`.
5. Click "Save settings".

## Usage
- Popup: click "Save page" to ingest the current tab URL.
- Context menu: select text, right click, choose "Save to DeepSave as Note".

## Status icon
- Grey: idle
- Blue: saving
- Green: success
- Red: error
