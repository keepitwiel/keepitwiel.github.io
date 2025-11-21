# Hydrodynamic Erosion Simulator

A small WebGL2-based hydrodynamic erosion simulator that runs in the browser. The project provides a canvas renderer and a compact control panel to tune rainfall, evaporation, erosion/deposition rates, simulation speed, terrain parameters and view mode.

**Files of interest**
- `index.html` — page and UI controls
- `style.css` — styling for UI and controls
- `main.js` — application logic and UI wiring
- `gpu-simulation.js` — WebGL2 simulation and shaders wiring
- `shaders.js` — GLSL shader sources
- `gpu-simulation.js`, `shaders.js` — GPU-side simulation code

## Prerequisites
- A modern browser with WebGL2 support (Chrome, Firefox, Safari 15+, Edge)
- Python 3 (for the quick local static server)

## Quick start (Python)
Open a terminal in the project folder and run:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open your browser at `http://localhost:8000`.

## Development server (no-cache)
If you want the browser to always fetch fresh files (recommended during development), run this small Python no-cache server instead:

```bash
python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, HTTPServer
class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()
HTTPServer(('127.0.0.1', 8000), NoCacheHandler).serve_forever()
PY
```

## Browser notes
- If the simulation does not start, open the browser console to check for errors (e.g., `WebGL 2 not supported`).

## UI behavior
- The simulator reads initial parameter values from the sliders/selects in `index.html` on load, so the UI defaults are applied automatically.
- Simulation auto-starts by default. Use the `Pause` button to stop the simulation and `Start` to resume.
- A compact status overlay shows `Running` / `Paused` and important parameters.

## Troubleshooting
- If you see a blank canvas or errors referencing WebGL, make sure your GPU/drivers and browser support WebGL2 and that the page is served via `http://` (file:// won't work for some features).
- If code changes aren't reflected in the browser, try the no-cache server above or append a cache-busting query to script/link tags in `index.html` (e.g. `main.js?v=20251121`).
