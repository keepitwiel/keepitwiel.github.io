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
        const thermalThresholdEl = document.getElementById('param-ravine-erosion-threshold');
        const thermalRateEl = document.getElementById('param-ravine-erosion-rate');

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
            thermalErosionThreshold: thermalThresholdEl ? parseFloat(thermalThresholdEl.value) : undefined,
            thermalErosionRate: thermalRateEl ? parseFloat(thermalRateEl.value) : undefined,

            viewSensitivity: sensEl ? parseFloat(sensEl.value) : undefined
        };

        this.simulation = new GPUSimulation(this.canvas, this.gridSize, initialParams);

        // Start running by default so the simulation begins on load
        this.isRunning = true;
        this.lastTime = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;

        this.simSpeed = 10;

        // Camera State
        this.cameraState = {
            azimuth: -Math.PI / 2,
            elevation: Math.PI / 4,
            distance: this.gridSize * 1.5,
            target: [this.gridSize / 2, this.gridSize / 2, 0],
            roll: 0
        };
        this.updateCamera();

        this.initUI();
        this.initInput();
        this.resize();

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

            // Orbit
            this.cameraState.azimuth -= dx * 0.01;
            this.cameraState.elevation = Math.max(0.01, Math.min(Math.PI / 2 - 0.01, this.cameraState.elevation + dy * 0.01));
            
            this.updateCamera();
            if (!this.isRunning) this.draw();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraState.distance *= (1 + e.deltaY * 0.001);
            this.updateCamera();
            if (!this.isRunning) this.draw();
        }, { passive: false });
    }

    updateCamera() {
        const { azimuth, elevation, distance, target } = this.cameraState;
        const x = target[0] + distance * Math.cos(elevation) * Math.cos(azimuth);
        const y = target[1] + distance * Math.cos(elevation) * Math.sin(azimuth);
        const z = target[2] + distance * Math.sin(elevation);
        
        this.simulation.params.cameraPos = [x, y, z];
        this.simulation.params.cameraTarget = target;
        this.simulation.params.cameraRoll = this.cameraState.roll;
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
        bindParam('param-ravine-erosion-threshold', 'thermalErosionThreshold');
        bindParam('param-ravine-erosion-rate', 'thermalErosionRate');

        // Speed Control
        const speedEl = document.getElementById('param-speed');
        const speedDisp = document.getElementById('val-speed');
        speedEl.oninput = (e) => {
            this.simSpeed = parseInt(e.target.value);
            speedDisp.textContent = this.simSpeed;
        };
        // Initialize speed from control
        this.simSpeed = parseInt(speedEl.value);
        speedDisp.textContent = this.simSpeed;
        // update status when speed changes
        speedEl.oninput = (e) => { this.simSpeed = parseInt(e.target.value); speedDisp.textContent = this.simSpeed; this.updateStatus(); };

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

            // Re-init simulation
            const oldParams = this.simulation.params;
            this.simulation = new GPUSimulation(this.canvas, this.gridSize, oldParams);

            // Reset camera target
            this.cameraState.target = [this.gridSize / 2, this.gridSize / 2, 0];
            this.cameraState.distance = this.gridSize * 1.5;
            this.updateCamera();

            this.resize();
        };
        // update status when size changes
        sizeEl.onchange = (e) => { const idx = parseInt(e.target.value); sizeDisp.textContent = `${sizes[idx]}x${sizes[idx]}`; this.updateStatus(); };

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
        const parts = [
            `${s}`,
            `Mode: ${mode}`,
            `Rain: ${p.rainRate}`,
            `Evap: ${p.evaporationRate}`,
            `Erode: ${p.erosionRate}`,
            `Deposit: ${p.depositionRate}`,
            `ThermThresh: ${p.thermalErosionThreshold}`,
            `ThermRate: ${p.thermalErosionRate}`,
            `Speed: ${this.simSpeed}`,
            `Sens: ${p.viewSensitivity}`
        ];
        el.textContent = parts.join(' • ');
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

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

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
