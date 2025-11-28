import { GPUSimulation } from './gpu-simulation.js';

class App {
    constructor() {
        this.canvas = document.getElementById('simCanvas');

        // Simulation parameters - initialize from the controls in `index.html` when possible
        const sizes = [256, 512, 1024, 2048];
        // Read UI values (DOM is available because App is constructed after DOMContentLoaded)

        // terrain generation
        const sizeEl = document.getElementById('param-size');
        const sizeIdx = sizeEl ? parseInt(sizeEl.value) || 0 : 3;
        this.gridSize = sizes[sizeIdx] || 1024;

        const slopeMagEl = document.getElementById('param-slope-mag');
        const slopeDirEl = document.getElementById('param-slope-dir');
        const octEl = document.getElementById('param-octaves');
        const gainEl = document.getElementById('param-gain');
        const waterEl = document.getElementById('param-water');

        // physics
        const rainEl = document.getElementById('param-rain');
        const evapEl = document.getElementById('param-evap');
        const erodeEl = document.getElementById('param-erode');
        const depositEl = document.getElementById('param-deposit');

        // view modes
        const sensEl = document.getElementById('param-sensitivity');
        
        const initialParams = {
            slopeMag: slopeMagEl ? parseFloat(slopeMagEl.value) : undefined,
            slopeDir: slopeDirEl ? parseFloat(slopeDirEl.value) : undefined,
            octaves: octEl ? parseInt(octEl.value) : undefined,
            gain: gainEl ? parseFloat(gainEl.value) : undefined,
            initialWaterLevel: waterEl ? parseFloat(waterEl.value) : undefined,

            rainRate: rainEl ? parseFloat(rainEl.value) : undefined,
            evaporationRate: evapEl ? parseFloat(evapEl.value) : undefined,
            erosionRate: erodeEl ? parseFloat(erodeEl.value) : undefined,
            depositionRate: depositEl ? parseFloat(depositEl.value) : undefined,

            viewSensitivity: sensEl ? parseFloat(sensEl.value) : undefined
        };

        this.simulation = new GPUSimulation(this.canvas, this.gridSize, initialParams);

        // Start running by default so the simulation begins on load
        this.isRunning = true;
        this.lastTime = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.lastStatsTime = 0;

        this.simSpeed = 10;

        // Camera State
        this.cameraState = {
            position: [this.gridSize / 2, -this.gridSize * 0.2, this.gridSize * 0.5],
            yaw: Math.PI / 2, // Looking North
            pitch: -Math.PI / 6, // Looking slightly down
            roll: 0
        };
        this.keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
        this.updateCamera();

        this.initUI();
        this.initInput();
        this.resize();
        this.loadVersion();

        window.addEventListener('resize', () => this.resize());

        // Start loop
        requestAnimationFrame((t) => this.loop(t));
    }

    initInput() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            const sensitivity = 0.005;
            this.cameraState.yaw -= dx * sensitivity;
            this.cameraState.pitch -= dy * sensitivity;
            
            // Clamp pitch
            const maxPitch = Math.PI / 2 - 0.01;
            this.cameraState.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.cameraState.pitch));

            this.updateCamera();
            if (!this.isRunning) {
                 this.draw();
            }
        });

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
            this.keys.shift = e.shiftKey;
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
            this.keys.shift = e.shiftKey;
        });
    }

    updateCamera() {
        const { position, yaw, pitch } = this.cameraState;
        
        // Calculate forward vector from yaw/pitch
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);
        
        const forward = [
            cosPitch * cosYaw,
            cosPitch * sinYaw,
            sinPitch
        ];
        
        const target = [
            position[0] + forward[0],
            position[1] + forward[1],
            position[2] + forward[2]
        ];

        this.simulation.params.cameraPos = position;
        this.simulation.params.cameraTarget = target;
        this.simulation.params.cameraRoll = this.cameraState.roll;
    }

    processInput(dt) {
        // Movement speed
        const baseSpeed = this.gridSize * 0.5; // Units per second
        const moveSpeed = (this.keys.shift ? 4.0 : 1.0) * baseSpeed * (dt / 1000.0);

        const { yaw } = this.cameraState;
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        
        // Forward vector on XY plane
        const forward = [c, s, 0];
        const right = [s, -c, 0];
        
        let moved = false;

        if (this.keys.w) {
            this.cameraState.position[0] += forward[0] * moveSpeed;
            this.cameraState.position[1] += forward[1] * moveSpeed;
            this.cameraState.position[2] += forward[2] * moveSpeed;
            moved = true;
        }
        if (this.keys.s) {
            this.cameraState.position[0] -= forward[0] * moveSpeed;
            this.cameraState.position[1] -= forward[1] * moveSpeed;
            this.cameraState.position[2] -= forward[2] * moveSpeed;
            moved = true;
        }
        if (this.keys.a) {
            this.cameraState.position[0] -= right[0] * moveSpeed;
            this.cameraState.position[1] -= right[1] * moveSpeed;
            moved = true;
        }
        if (this.keys.d) {
            this.cameraState.position[0] += right[0] * moveSpeed;
            this.cameraState.position[1] += right[1] * moveSpeed;
            moved = true;
        }
        if (this.keys.e) {
            this.cameraState.position[2] += moveSpeed;
            moved = true;
        }
        if (this.keys.q) {
            this.cameraState.position[2] -= moveSpeed;
            moved = true;
        }
        
        if (moved) {
            this.updateCamera();
        }
    }

    initUI() {
        // Buttons
        document.getElementById('btn-start').onclick = () => { this.isRunning = true; this.updateStatus(); };
        document.getElementById('btn-stop').onclick = () => { this.isRunning = false; this.updateStatus(); };
        document.getElementById('btn-reset').onclick = () => {
            this.simulation.reset();
            this.draw();
        };

        // Parameters
        const bindParam = (id, targetProp) => {
            const el = document.getElementById(id);
            const disp = document.getElementById(id.replace('param-', 'val-'));
            el.oninput = (e) => {
                const val = parseFloat(e.target.value);
                this.simulation.params[targetProp] = val;
                disp.textContent = val;
                this.updateStatus();
            };
            // Init value
            this.simulation.params[targetProp] = parseFloat(el.value);
        };

        bindParam('param-rain', 'rainRate');
        bindParam('param-evap', 'evaporationRate');
        bindParam('param-erode', 'erosionRate');
        bindParam('param-deposit', 'depositionRate');

        // Speed Control
        const speedEl = document.getElementById('param-speed');
        const speedDisp = document.getElementById('val-speed');
        speedEl.oninput = (e) => {
            this.simSpeed = parseInt(e.target.value);
            speedDisp.textContent = this.simSpeed;
            this.updateStatus();
        };
        // Initialize speed from control
        this.simSpeed = parseInt(speedEl.value);
        speedDisp.textContent = this.simSpeed;

        // Octaves Control
        const octEl = document.getElementById('param-octaves');
        const octDisp = document.getElementById('val-octaves');
        octEl.onchange = (e) => {
            const val = parseInt(e.target.value);
            this.simulation.params.octaves = val;
            octDisp.textContent = val;
            this.simulation.reset();
            this.draw();
        };
        octEl.oninput = (e) => {
            octDisp.textContent = e.target.value;
        };
        // Initialize octaves from control
        const initOct = parseInt(octEl.value);
        this.simulation.params.octaves = initOct;
        octDisp.textContent = octEl.value;
        // ensure status reflects initial octaves
        this.updateStatus();

        // Gain Control
        const gainEl = document.getElementById('param-gain');
        const gainDisp = document.getElementById('val-gain');
        gainEl.onchange = (e) => {
            const val = parseFloat(e.target.value);
            this.simulation.params.gain = val;
            gainDisp.textContent = val;
            this.simulation.reset();
            this.draw();
        };
        gainEl.oninput = (e) => {
            gainDisp.textContent = e.target.value;
        };
        // Initialize gain from control
        const initGain = parseFloat(gainEl.value);
        this.simulation.params.gain = initGain;
        gainDisp.textContent = gainEl.value;

        // Slope Magnitude Control
        const slopeMagEl = document.getElementById('param-slope-mag');
        const slopeMagDisp = document.getElementById('val-slope-mag');
        slopeMagEl.onchange = (e) => {
            const val = parseFloat(e.target.value);
            this.simulation.params.slopeMag = val;
            slopeMagDisp.textContent = val;
            this.simulation.reset();
            this.draw();
        };
        slopeMagEl.oninput = (e) => {
            slopeMagDisp.textContent = e.target.value;
        };
        // Initialize slope mag
        this.simulation.params.slopeMag = parseFloat(slopeMagEl.value);
        slopeMagDisp.textContent = slopeMagEl.value;

        // Slope Direction Control
        const slopeDirEl = document.getElementById('param-slope-dir');
        const slopeDirDisp = document.getElementById('val-slope-dir');
        slopeDirEl.onchange = (e) => {
            const val = parseFloat(e.target.value);
            this.simulation.params.slopeDir = val;
            slopeDirDisp.textContent = val;
            this.simulation.reset();
            this.draw();
        };
        slopeDirEl.oninput = (e) => {
            slopeDirDisp.textContent = e.target.value;
        };
        // Initialize slope dir
        this.simulation.params.slopeDir = parseFloat(slopeDirEl.value);
        slopeDirDisp.textContent = slopeDirEl.value;

        // Map Size Control
        const sizeEl = document.getElementById('param-size');
        const sizeDisp = document.getElementById('val-size');
        const sizes = [256, 512, 1024, 2048];

        sizeEl.oninput = (e) => {
            const idx = parseInt(e.target.value);
            sizeDisp.textContent = `${sizes[idx]}x${sizes[idx]}`;
        };

        // Initialize size control to match current gridSize (or fallback to control value)
        const currentSizeIdx = sizes.indexOf(this.gridSize);
        const initSizeIdx = currentSizeIdx >= 0 ? currentSizeIdx : parseInt(sizeEl.value);
        sizeEl.value = initSizeIdx;
        sizeDisp.textContent = `${sizes[initSizeIdx]}x${sizes[initSizeIdx]}`;

        sizeEl.onchange = (e) => {
            const idx = parseInt(e.target.value);
            const newSize = sizes[idx];
            this.gridSize = newSize;
            sizeDisp.textContent = `${sizes[idx]}x${sizes[idx]}`;

            // Re-init simulation
            const oldParams = this.simulation.params;
            this.simulation = new GPUSimulation(this.canvas, this.gridSize, oldParams);

            // Reset camera target
            this.cameraState.target = [this.gridSize / 2, this.gridSize / 2, 0];
            this.cameraState.distance = this.gridSize * 1.5;
            this.updateCamera();

            this.resize();
            this.updateStatus();
        };

        // Water Level Control
        const waterEl = document.getElementById('param-water');
        const waterDisp = document.getElementById('val-water');
        waterEl.onchange = (e) => {
            const val = parseFloat(e.target.value);
            this.simulation.params.initialWaterLevel = val;
            waterDisp.textContent = val;
            this.simulation.reset();
            this.draw();
        };
        waterEl.oninput = (e) => {
            waterDisp.textContent = e.target.value;
        };
        // Initialize water level from control
        this.simulation.params.initialWaterLevel = parseFloat(waterEl.value);
        waterDisp.textContent = waterEl.value;
        // reflect initial water in status
        this.updateStatus();

        // View Sensitivity
        const sensEl = document.getElementById('param-sensitivity');
        const sensDisp = document.getElementById('val-sensitivity');
        sensEl.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.simulation.params.viewSensitivity = val;
            sensDisp.textContent = val;
            this.draw();
        };
        // Initialize sensitivity from the control so the simulation uses it immediately
        this.simulation.params.viewSensitivity = parseFloat(sensEl.value);
        sensDisp.textContent = sensEl.value;

        // View Mode
        document.getElementById('view-mode').onchange = (e) => {
            if (!this.isRunning) this.draw();
            this.updateStatus();
        };

        // Toggle Status Bar
        document.getElementById('btn-toggle-status').onclick = () => {
            const el = document.getElementById('status');
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        };

        // Collapsible groups
        document.querySelectorAll('.control-supergroup-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    }

    updateStatus() {
        const el = document.getElementById('status');
        if (!el) return;
        const mode = document.getElementById('view-mode').value;
        const s = this.isRunning ? 'Running' : 'Paused';
        const p = this.simulation.params;
        const stats = this.simulation.calculateStats();
        
        const camPos = this.cameraState.position.map(v => v.toFixed(1)).join(', ');
        const camYaw = (this.cameraState.yaw * 180 / Math.PI).toFixed(1);
        const camPitch = (this.cameraState.pitch * 180 / Math.PI).toFixed(1);

        const parts = [
            `STATUS:           ${s}`,
            ``,
            `CAMERA`,
            `----------`,
            `Position:         [${camPos}]`,
            `Yaw:              ${camYaw}°`,
            `Pitch:            ${camPitch}°`,
            ``,
            `PARAMETERS`,
            `----------`,
            `View mode:        ${mode}`,
            `Rain rate:        ${p.rainRate}`,
            `Evaporation rate: ${p.evaporationRate}`,
            `Erosion rate:     ${p.erosionRate}`,
            `Deposition rate:  ${p.depositionRate}`,
            `Simulation speed: ${this.simSpeed}`,
            `View sensitivity: ${p.viewSensitivity}`,
            `Terrain size:     ${p.gridSize}`,
            `fBm octaves:      ${p.octaves}`,
            `fBm gain:         ${p.gain}`,
            `Slope magnitude:  ${p.slopeMag}`,
            `Slope direction:  ${p.slopeDir}`,
            `Init water level: ${p.initialWaterLevel}`,
            ``,
            `STATISTICS`,
            `----------`,
            `Water total:        ${stats.water.toFixed(0)}`,
            `Terrain total:      ${stats.terrain.toFixed(0)}`,
            `Sediment total:     ${stats.sediment.toFixed(0)}`,
            `Terrain + sediment: ${(stats.terrain + stats.sediment).toFixed(0)}`,
            ``,
            `VERSION`,
            `----------`,
            `${this.versionString || 'Loading...'}`,
        ];
        el.innerText = parts.join('\n');
    }

    resize() {
        // Canvas size matches window/container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        if (!this.isRunning) this.draw();
    }

    draw() {
        const viewMode = document.getElementById('view-mode').value;
        this.simulation.draw(viewMode);
    }

    async loadVersion() {
        try {
            const response = await fetch('version.json');
            const data = await response.json();
            console.log(`Build: ${data.build} (${data.date})`);
            
            // Add version to status bar if it exists
            const el = document.getElementById('status');
            if (el) {
                this.versionString = `Build: ${data.build}`;
            }
        } catch (e) {
            console.warn('Could not load version info');
        }
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.processInput(dt);

        if (this.isRunning) {
            for (let i = 0; i < this.simSpeed; i++) {
                this.simulation.step();
            }
            document.getElementById('step-counter').textContent = this.simulation.steps;
        }

        this.draw();

        // FPS
        this.frameCount++;
        if (timestamp - this.lastFpsTime >= 1000) {
            document.getElementById('fps-counter').textContent = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = timestamp;
        }

        // update status (every 500ms)
        if (timestamp - this.lastStatsTime >= 500) {
            this.updateStatus();
            this.lastStatsTime = timestamp;
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Start app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        new App();
    } catch (err) {
        console.error('Failed to initialize App:', err);
    }
});
