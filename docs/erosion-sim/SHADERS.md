SHADERS.md
===========

This document describes the GLSL ES 3.00 shaders used by the GPU erosion simulation in `docs/erosion-sim/shaders.js`.
It explains the purpose of each shader, the inputs and outputs, algorithmic details, edge handling, and tuning tips.

Overview
--------

- Shaders target `#version 300 es` (WebGL2 / GLSL ES 3.00).
- Most data (terrain heights, water depth, flux, sediment, velocity) is stored in single-channel textures and read with `texelFetch(..., ivec2(gl_FragCoord.xy), 0)`.
- Convention: red channel (`.r`) holds the scalar quantity for that texture (height, water depth, etc.).
- Coordinate space: many shaders use integer fragment coordinates (`ivec2(gl_FragCoord.xy)`) and a `u_size` vec2 uniform describing texture width/height.
- Ordering of flux vector components (where applicable): x = left, y = right, z = top, w = bottom.

Shader list
-----------

1) VERTEX_SHADER
-----------------
Purpose
- Minimal passthrough vertex shader used for full-screen quad rendering. It simply forwards an input position to `gl_Position`.

Inputs / outputs
- in vec4 a_position; -> gl_Position

Notes
- This shader is intentionally trivial: all rendering and computation occurs in fragment shaders.

2) RAIN_SHADER
--------------
Purpose
- Adds rainfall to the water texture. This shader increments water depth at each texel by `u_rainRate * u_dt`.

Uniforms / samplers
- `uniform sampler2D u_water` — current water-depth texture (red channel)
- `uniform float u_rainRate` — rain addition per second (units same as water depth)
- `uniform float u_dt` — simulation timestep (seconds)

Outputs
- `out vec4 outColor` — writes new water depth into red channel (alpha set=1)

Algorithm
- Fetch current water depth using `texelFetch` at the fragment coordinate.
- Add `u_rainRate * u_dt` and write back.

Tuning
- `u_rainRate` controls how fast the simulation receives water input. Use small values consistent with the simulation scale.

Edge handling
- None special; rainfall is applied per texel and independent of neighbors.

3) FLUX_SHADER
---------------
Purpose
- Computes per-cell outgoing fluxes toward each of its four neighbors (left, right, top, bottom).
- Flux is driven by height differences (terrain + water) and a simple pipe-flow approximation.

Uniforms / samplers
- `u_terrain` (sampler2D) — terrain elevation (red)
- `u_water` (sampler2D) — water depth (red)
- `u_flux` (sampler2D) — previous flux values (vec4) where components are outgoing fluxes [L,R,T,B]
- `u_dt` (float) — timestep
- `u_gravity` (float) — gravity constant used in flux acceleration
- `u_pipeLength` (float) — length scale for flux calculation (affects flow magnitude)
- `u_size` (vec2) — texture dimensions

Outputs
- `out vec4 outColor` — new outgoing fluxes scaled so that total outgoing volume doesn't exceed available water

Algorithm details
- For current texel, compute total height h = terrain + water.
- Read neighboring heights (hL, hR, hT, hB). For boundary cells, neighbor height defaults to current height (no flow off-edge).
- Compute dH vector = (h - hL, h - hR, h - hT, h - hB).
- Update flux with: newFlux = max(0, flux + factor * dH), where factor = u_dt * u_gravity / u_pipeLength.
- Compute sum of outgoing fluxes; if sum * u_dt > water (i.e., flux would remove more volume than exists), scale fluxes by K = w / (sum * u_dt) to conserve mass.

Interpretation & assumptions
- Flux components store outgoing volume-per-time toward that neighbor.
- The shader clamps flows to be non-negative (only outflow stored); inflow is handled in the WATER_SHADER by reading adjacent flux components.
- This is a simplified hydraulic model that balances ease-of-implementation and stability.

Edge handling
- For edges, neighbor heights are taken equal to current height to prevent flow off the simulation domain.

Performance notes
- Uses four neighboring `texelFetch` calls and several arithmetic operations per texel. Reasonable for moderate grid sizes (e.g., 512^2) on modern GPUs, but scale accordingly.

4) WATER_SHADER
----------------
Purpose
- Update the water depth by applying outflow (flux leaving the cell), inflow (flux coming from neighbors), and evaporation.

Uniforms / samplers
- `u_water` — current water depth (red)
- `u_flux` — outgoing fluxes (vec4) from FLUX_SHADER
- `u_dt` — timestep
- `u_evapRate` — evaporation rate (per second)
- `u_size` — texture dimensions

Outputs
- `out vec4 outColor` — updated water depth in red channel

Algorithm details
- Compute `outFlow` = sum of current cell's outgoing flux components.
- Compute `inFlow` by sampling the appropriate components of neighboring flux textures (e.g., left neighbor's right flux contributes to this cell's inflow from left).
- Change in water: dw = u_dt * (inFlow - outFlow)
- newW = max(0, w + dw)
- Apply evaporation multiplicatively: newW *= (1.0 - u_evapRate * u_dt)

Notes
- Ensures non-negative water depth.
- The flux/water units should be consistent (flux units such that flux * dt equals volume change in depth units).

5) VELOCITY_SHADER
-------------------
Purpose
- Compute per-cell 2D velocity (u, v) from fluxes. Velocity is derived from net flux imbalance normalized by local water depth.

Uniforms / samplers
- `u_water` — water depth (red)
- `u_flux` — outgoing fluxes (vec4)
- `u_size` — texture dimensions

Outputs
- `out vec4 outColor` — velocity stored in `.xy` (u, v)

Algorithm details
- Compute inflow components from neighbors (same pattern as in WATER_SHADER).
- Compute average flux in X and Y directions:
  - fluxX = 0.5 * (inL - outL + outR - inR)
  - fluxY = 0.5 * (inT - outT + outB - inB) (note the shader uses the component ordering consistent with FLUX)
- Compute velocity = flux / depth, with a small epsilon in the denominator to avoid division by zero (d = max(0.001, w)).

Interpretation
- Velocity is the volumetric flux divided by depth, giving an approximate horizontal velocity field that drives sediment advection and erosion capacity.

6) EROSION_SHADER
------------------
Purpose
- Simulate erosion and deposition per cell based on local velocity and sediment capacity.
- This shader writes to two draw buffers (multiple render targets): updated terrain and updated sediment.

Uniforms / samplers
- `u_terrain` — current terrain height (red)
- `u_sediment` — current sediment concentration (red)
- `u_velocity` — per-cell velocity (xy)
- `u_dt` — timestep
- `u_erosionRate` — factor controlling erosion capacity (Kc)
- `u_depositionRate` — rate for deposition when capacity < current sediment

Outputs
- `layout(location = 0) out vec4 outTerrain` — new terrain height
- `layout(location = 1) out vec4 outSediment` — new sediment concentration

Algorithm details
- Compute speed = length(v).
- capacity = u_erosionRate * speed (simple proportional capacity)
- diff = capacity - s (positive => erode, negative => deposit)
- If diff > 0: erode amount = u_erosionRate * diff * u_dt (subtract from terrain, add to sediment).
- Else: deposit amount = u_depositionRate * (-diff) * u_dt (add to terrain, remove from sediment).

Notes & caveats
- This is a local-only erosion/deposition model (no neighborhood smoothing). It uses parameters that must be tuned to avoid excessive erosion or numerical instability.
- Writing two render targets requires the WebGL2 setup to allocate a framebuffer with multiple color attachments and proper floating-point texture formats.

7) TRANSPORT_SHADER
--------------------
Purpose
- Advect (transport) sediment using the velocity field by backtracing: sample sediment from the previous position along the velocity vector.

Uniforms / samplers
- `u_sediment` — sediment texture (red)
- `u_velocity` — velocity texture (xy)
- `u_dt` — timestep
- `u_size` — texture dimensions

Outputs
- `out vec4 outColor` — advected sediment value in red channel

Algorithm details
- Compute fragment coordinate `coord = gl_FragCoord.xy` (pixel space).
- Read velocity `v = texture(u_velocity, coord / size).xy` (note: this uses normalized coords and `texture()` rather than `texelFetch`).
- Backtrace: oldPos = coord - v * u_dt
- Sample `u_sediment` at `oldPos / size` using `texture()` to get bilinear interpolation, and write that value.

Notes
- Using `texture()` instead of `texelFetch` enables smooth advection (bilinear interpolation). Backtracing is a simple first-order semi-Lagrangian method.
- Careful with boundary conditions: sampling outside [0,1] will depend on the sampler wrap mode; prefer `CLAMP_TO_EDGE`.

8) RENDER_SHADER
-----------------
Purpose
- Composite visualization shader that combines terrain, water, and sediment textures for viewing. Supports several view modes (terrain, heightmap, water, sediment) and hillshading.

Uniforms / samplers
- `u_terrain`, `u_water`, `u_sediment` — data textures
- `u_size` — texture dimensions
- `u_viewMode` (int): 0 = Terrain (shaded), 1 = Height (grayscale), 2 = Water (blue scale), 3 = Sediment (orange/brown scale)
- `u_viewSensitivity` (float) — multiplier for visual sensitivity of water/sediment channels

Algorithm details
- For terrain mode:
  - Compute neighbor heights and central differences to estimate normal vector `n`.
  - Use a fixed light direction and compute Lambertian diffuse term; apply small ambient and specular tweaks.
  - Palette selection based on normalized height `hNorm = h / 100.0` maps to green/brown/gray colors.
  - If water is present, blend water color (mix of blue and muddy brown based on sediment) over terrain with alpha proportional to depth.
- Other modes produce simple visualizations (grayscale height, blue intensity for water, brown/orange for sediment) scaled by `u_viewSensitivity`.

Integration notes
-----------------
- `gpu-simulation.js` imports `shaders.js` and compiles these sources into WebGL programs. See `docs/erosion-sim/gpu-simulation.js` for the wiring and uniform locations.
- Textures expected format:
  - Single-channel float textures for scalar fields (terrain, water, sediment). In WebGL2, use `gl.R32F` (if available) or `gl.RGBA32F` and store value in `.r`.
  - Velocity and flux can be stored in `RG32F`/`RGBA32F` as needed.
  - Use `NEAREST` filtering for fields that rely on exact texel values (when using `texelFetch`). Use `LINEAR` for velocity when the transport shader reads interpolated velocity.
  - Sampler wrap mode should be `CLAMP_TO_EDGE` to avoid wrapping artifacts at domain boundaries.

Performance & correctness tips
-----------------------------
- Consistency: ensure `u_dt`, `u_pipeLength`, `u_gravity`, and rate constants use consistent units. Small `u_dt` improves stability.
- Precision: prefer highp floats for intermediate calculations (shaders already use `precision highp float;`).
- Multi-render targets: when using `EROSION_SHADER`, ensure the framebuffer is set up with multiple color attachments and matching textures.
- Debugging: use `RENDER_SHADER`'s `u_viewMode` to inspect intermediate fields (set to water/sediment/height).
- Stability: if flux/water oscillations occur, reduce `u_dt`, lower `u_gravity`, increase `u_pipeLength`, or apply small numerical damping.

Suggested parameter starting points (example only)
-----------------------------------------------
- `u_dt`: 0.1 (seconds)
- `u_gravity`: 9.81
- `u_pipeLength`: 1.0
- `u_rainRate`: 0.001
- `u_evapRate`: 0.0001
- `u_erosionRate`: 0.1
- `u_depositionRate`: 0.05

File references
---------------
- Shader sources: `docs/erosion-sim/shaders.js`
- Simulation wiring: `docs/erosion-sim/gpu-simulation.js`
- Example HTML and UI: `docs/erosion-sim/index.html`, `docs/erosion-sim/main.js`

If you want, I can:
- add inline comments to `shaders.js` itself summarizing each uniform and the data layout,
- or generate a small diagram showing data flow between shaders (terrain -> flux -> water -> velocity -> erosion -> transport -> render).
