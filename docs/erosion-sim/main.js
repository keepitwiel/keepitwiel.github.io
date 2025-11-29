import { GPUSimulation } from './gpu-simulation.js';

class App {
    constructor() {
        this.canvas = document.getElementById('simCanvas');
        this.sizes = [256, 512, 1024, 2048];
        
        // State
        this.isRunning = true;
        this.simSpeed = 10;
        this.lastTime = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.lastStatsTime = 0;
        this.keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };

        this.initSimulation();
        this.initCamera();
        this.initInput();
        this.initUI();
        
        this.resize();
        this.loadVersion();

        window.addEventListener('resize', () => this.resize());
        requestAnimationFrame((t) => this.loop(t));
    }

    initSimulation() {
        // Read initial values from DOM
        const getVal = (id, isInt = false, def = 0) => {
            const el = document.getElementById(id);
            if (!el) return def;
            return isInt ? parseInt(el.value) : parseFloat(el.value);
        };

        const sizeIdx = getVal('param-size', true, 3);
        this.gridSize = this.sizes[sizeIdx] || 1024;

        const initialParams = {
            slopeMag: getVal('param-slope-mag'),
            slopeDir: getVal('param-slope-dir'),
            octaves: getVal('param-octaves', true),
            gain: getVal('param-gain'),
            initialWaterLevel: getVal('param-water'),
            seed: document.getElementById('param-seed') ? document.getElementById('param-seed').value : '12345',

            rainRate: getVal('param-rain'),
            evaporationRate: getVal('param-evap'),
            erosionRate: getVal('param-erode'),
            depositionRate: getVal('param-deposit'),

            viewSensitivity: getVal('param-sensitivity')
        };

        this.simulation = new GPUSimulation(this.canvas, this.gridSize, initialParams);
        
        // Initialize simSpeed from UI
        this.simSpeed = getVal('param-speed', true, 10);
    }

    initCamera() {
        this.cameraState = {
            position: [this.gridSize / 2, -this.gridSize * 0.2, this.gridSize * 0.5],
            yaw: Math.PI / 2, // Looking North
            pitch: -Math.PI / 6, // Looking slightly down
            roll: 0
        };
        this.updateCamera();
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

        const handleKey = (e, isDown) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = isDown;
            this.keys.shift = e.shiftKey;
        };

        window.addEventListener('keydown', (e) => handleKey(e, true));
        window.addEventListener('keyup', (e) => handleKey(e, false));
    }

    initUI() {
        this.initButtons();
        this.initControls();
        this.initPopups();
        
        // Collapsible groups
        document.querySelectorAll('.control-supergroup-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    }

    initButtons() {
        // Pause Button
        const pauseBtn = document.getElementById('btn-pause');
        if (pauseBtn) {
            pauseBtn.onclick = () => {
                this.isRunning = !this.isRunning;
                if (this.isRunning) {
                    pauseBtn.innerText = 'Pause';
                    pauseBtn.classList.remove('active');
                } else {
                    pauseBtn.innerText = 'Paused';
                    pauseBtn.classList.add('active');
                }
                this.updateStatus();
            };
        }

        // Toggle Status Bar
        const toggleStatusBtn = document.getElementById('btn-toggle-status');
        if (toggleStatusBtn) {
            toggleStatusBtn.onclick = () => {
                const el = document.getElementById('status');
                const isHidden = el.style.display === 'none';
                el.style.display = isHidden ? 'block' : 'none';
                toggleStatusBtn.classList.toggle('active', isHidden);
            };
        }

        // View Mode
        const viewModeEl = document.getElementById('view-mode');
        if (viewModeEl) {
            viewModeEl.onchange = () => {
                if (!this.isRunning) this.draw();
                this.updateStatus();
            };
        }
    }

    initControls() {
        // Helper to bind simulation parameters
        const bindParam = (id, targetProp, isInt = false) => {
            const el = document.getElementById(id);
            const disp = document.getElementById(id.replace('param-', 'val-'));
            if (!el || !disp) return;

            const update = () => {
                const val = isInt ? parseInt(el.value) : parseFloat(el.value);
                this.simulation.params[targetProp] = val;
                disp.textContent = val;
                this.updateStatus();
            };
            el.oninput = update;
            // Initial sync
            disp.textContent = el.value;
        };

        // Physics
        bindParam('param-rain', 'rainRate');
        bindParam('param-evap', 'evaporationRate');
        bindParam('param-erode', 'erosionRate');
        bindParam('param-deposit', 'depositionRate');
        
        // Visualization
        bindParam('param-sensitivity', 'viewSensitivity');

        // Speed Control (Special case as it's on App, not simulation.params)
        const speedEl = document.getElementById('param-speed');
        const speedDisp = document.getElementById('val-speed');
        if (speedEl && speedDisp) {
            speedEl.oninput = (e) => {
                this.simSpeed = parseInt(e.target.value);
                speedDisp.textContent = this.simSpeed;
                this.updateStatus();
            };
            speedDisp.textContent = speedEl.value;
        }
    }

    initPopups() {
        // Splash Screen
        const splash = document.getElementById('splash-screen');
        const closeSplash = document.getElementById('btn-close-splash');
        const helpBtn = document.getElementById('btn-help');

        if (splash && closeSplash) {
            closeSplash.onclick = () => splash.style.display = 'none';
        }
        if (helpBtn && splash) {
            helpBtn.onclick = () => splash.style.display = 'flex';
        }

        // Map Generation Popup
        const mapGenPopup = document.getElementById('map-gen-popup');
        const mapGenBtn = document.getElementById('btn-map-gen');
        const closeMapGenBtn = document.getElementById('btn-close-map-gen');
        const generateBtn = document.getElementById('btn-generate-map');

        if (mapGenBtn && mapGenPopup) {
            mapGenBtn.onclick = () => mapGenPopup.style.display = 'block';
        }
        if (closeMapGenBtn && mapGenPopup) {
            closeMapGenBtn.onclick = () => mapGenPopup.style.display = 'none';
        }

        // Bind Map Gen Controls (Display only, applied on Generate)
        const bindDisplay = (id, isInt = false, formatter = null) => {
            const el = document.getElementById(id);
            const disp = document.getElementById(id.replace('param-', 'val-'));
            if (!el || !disp) return;

            el.oninput = (e) => {
                const val = isInt ? parseInt(e.target.value) : parseFloat(e.target.value);
                disp.textContent = formatter ? formatter(val) : val;
            };
            // Initial sync
            const initVal = isInt ? parseInt(el.value) : parseFloat(el.value);
            disp.textContent = formatter ? formatter(initVal) : initVal;
        };

        bindDisplay('param-octaves', true);
        bindDisplay('param-gain');
        bindDisplay('param-slope-mag');
        bindDisplay('param-slope-dir');
        bindDisplay('param-water');
        bindDisplay('param-size', true, (idx) => `${this.sizes[idx]}x${this.sizes[idx]}`);

        if (generateBtn) {
            generateBtn.onclick = () => this.generateMap(mapGenPopup);
        }

        // Random Seed Button
        const randomSeedBtn = document.getElementById('btn-random-seed');
        if (randomSeedBtn) {
            randomSeedBtn.onclick = () => {
                const seedEl = document.getElementById('param-seed');
                if (seedEl) {
                    seedEl.value = Math.floor(Math.random() * 1000000).toString();
                }
            };
        }
    }

    generateMap(popup) {
        const getVal = (id, isInt = false) => {
            const el = document.getElementById(id);
            return isInt ? parseInt(el.value) : parseFloat(el.value);
        };

        // Update params from UI
        this.simulation.params.octaves = getVal('param-octaves', true);
        this.simulation.params.gain = getVal('param-gain');
        this.simulation.params.slopeMag = getVal('param-slope-mag');
        this.simulation.params.slopeDir = getVal('param-slope-dir');
        this.simulation.params.initialWaterLevel = getVal('param-water');
        
        const seedEl = document.getElementById('param-seed');
        if (seedEl) {
            this.simulation.params.seed = seedEl.value;
        }

        // Handle size change
        const sizeIdx = getVal('param-size', true);
        const newSize = this.sizes[sizeIdx];
        
        if (newSize !== this.gridSize) {
            this.gridSize = newSize;
            // Re-init simulation with new size
            const oldParams = this.simulation.params;
            this.simulation = new GPUSimulation(this.canvas, this.gridSize, oldParams);
            
            // Reset camera target
            this.cameraState.position = [this.gridSize / 2, -this.gridSize * 0.2, this.gridSize * 0.5];
            this.updateCamera();
            this.resize();
        } else {
            this.simulation.reset();
        }
        
        this.draw();
        this.updateStatus();
        
        if (popup) {
            popup.style.display = 'none';
        }
    }

    updateCamera() {
        const { position, yaw, pitch } = this.cameraState;
        
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
        const baseSpeed = this.gridSize * 0.5;
        const moveSpeed = (this.keys.shift ? 4.0 : 1.0) * baseSpeed * (dt / 1000.0);

        const { yaw } = this.cameraState;
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        
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

        this.frameCount++;
        if (timestamp - this.lastFpsTime >= 1000) {
            document.getElementById('fps-counter').textContent = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = timestamp;
        }

        if (timestamp - this.lastStatsTime >= 500) {
            this.updateStatus();
            this.lastStatsTime = timestamp;
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    try {
        new App();
    } catch (err) {
        console.error('Failed to initialize App:', err);
    }
});
