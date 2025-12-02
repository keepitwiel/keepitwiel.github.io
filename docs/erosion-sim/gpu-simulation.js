import * as Shaders from './shaders/index.js';

export class GPUSimulation {
    constructor(canvas, size, initialParams = {}) {
        this.canvas = canvas;
        this.size = size;
        this.steps = 0;

        this.gl = canvas.getContext('webgl2', { antialias: false });
        if (!this.gl) {
            throw new Error("WebGL 2 not supported");
        }

        // Enable float textures
        this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('OES_texture_float_linear');

        this.params = {
            rainRate: 0.001,
            evaporationRate: 0.001,
            erosionRate: 0.01,
            depositionRate: 0.01,
            gravity: 9.8,
            pipeLength: 10.0,
            dt: 0.1,
            octaves: 10,
            gain: 0.55,
            amp: 100,
            slopeMag: 0,
            slopeDir: 0,
            initialWaterLevel: 0,
            viewSensitivity: 10,
            cameraPos: [size/2, -size/2, size/2],
            cameraTarget: [size/2, size/2, 0],
            fov: 60.0,
            cameraRoll: 0.0,
            seed: 12345,
            ...initialParams
        };

        this.programs = {};
        this.textures = {};
        this.framebuffers = {};

        this.initShaders();
        this.initTextures();
        this.initFramebuffers();

        // Full screen quad
        this.quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]), this.gl.STATIC_DRAW);

        this.reset();
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fs));
        }

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        return prog;
    }

    initShaders() {
        const vs = Shaders.VERTEX_SHADER;
        this.programs.rain = this.createProgram(vs, Shaders.RAIN_SHADER);
        this.programs.flux = this.createProgram(vs, Shaders.FLUX_SHADER);
        this.programs.water = this.createProgram(vs, Shaders.WATER_SHADER);
        this.programs.velocity = this.createProgram(vs, Shaders.VELOCITY_SHADER);
        this.programs.erosion = this.createProgram(vs, Shaders.EROSION_SHADER);
        this.programs.render = this.createProgram(vs, Shaders.RENDER_SHADER);
        this.programs.probe = this.createProgram(vs, Shaders.PROBE_SHADER);
        this.programs.splat = this.createProgram(vs, Shaders.SPLAT_SHADER);
        this.programs.stats = this.createProgram(vs, Shaders.STATS_SHADER);
    }

    createTexture() {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.size, this.size, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    initTextures() {
        // Ping-pong buffers
        this.textures.terrainA = this.createTexture();
        this.textures.terrainB = this.createTexture();

        this.textures.waterA = this.createTexture();
        this.textures.waterB = this.createTexture();

        this.textures.sedimentA = this.createTexture();
        this.textures.sedimentB = this.createTexture();

        this.textures.fluxA = this.createTexture();
        this.textures.fluxB = this.createTexture();

        this.textures.velocity = this.createTexture(); // No ping-pong needed usually, but maybe for consistency

        // Stats texture (small)
        this.statsSize = 32;
        this.textures.stats = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.stats);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, this.statsSize, this.statsSize, 0, this.gl.RGBA, this.gl.FLOAT, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        // Probe result texture (1x1)
        this.textures.probe = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.probe);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, 1, 1, 0, this.gl.RGBA, this.gl.FLOAT, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    }

    initFramebuffers() {
        this.framebuffers.sim = this.gl.createFramebuffer();
        this.framebuffers.stats = this.gl.createFramebuffer();
        this.framebuffers.probe = this.gl.createFramebuffer();
    }

    // Run the probe shader for a given mouse position (pixel coordinates, WebGL origin bottom-left)
    runProbe(mouseX, mouseY) {
        const gl = this.gl;
        gl.useProgram(this.programs.probe);

        // Bind inputs (terrain, water, sediment, velocity)
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.uniform1i(gl.getUniformLocation(this.programs.probe, 'u_terrain'), 0);

        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures.waterA);
        gl.uniform1i(gl.getUniformLocation(this.programs.probe, 'u_water'), 1);

        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.textures.sedimentA);
        gl.uniform1i(gl.getUniformLocation(this.programs.probe, 'u_sediment'), 2);

        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.textures.velocity);
        gl.uniform1i(gl.getUniformLocation(this.programs.probe, 'u_velocity'), 3);

        // Uniforms
        gl.uniform2fv(gl.getUniformLocation(this.programs.probe, 'u_size'), [this.size, this.size]);
        gl.uniform2fv(gl.getUniformLocation(this.programs.probe, 'u_resolution'), [this.canvas.width, this.canvas.height]);
        gl.uniform2fv(gl.getUniformLocation(this.programs.probe, 'u_mouse'), [mouseX, mouseY]);

        gl.uniform3fv(gl.getUniformLocation(this.programs.probe, 'u_cameraPos'), this.params.cameraPos);
        gl.uniform3fv(gl.getUniformLocation(this.programs.probe, 'u_cameraTarget'), this.params.cameraTarget);
        gl.uniform1f(gl.getUniformLocation(this.programs.probe, 'u_fov'), this.params.fov);
        gl.uniform1f(gl.getUniformLocation(this.programs.probe, 'u_cameraRoll'), this.params.cameraRoll);

        // Render to 1x1 probe texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.probe);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.probe, 0);
        gl.viewport(0, 0, 1, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Read back pixel
        const pixels = new Float32Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixels);

        // Restore default framebuffer viewport (some callers expect to render to canvas afterwards)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        return [pixels[0], pixels[1]];
    }

    // Shader-based splat: add an amount to terrain texels in a radius around world coords
    // worldX/worldY are in texel coordinates (0..size-1)
    splatAt(worldX, worldY, amount, radius) {
        const gl = this.gl;
        gl.useProgram(this.programs.splat);

        // Bind input terrain texture
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.uniform1i(gl.getUniformLocation(this.programs.splat, 'u_terrain'), 0);

        gl.uniform2fv(gl.getUniformLocation(this.programs.splat, 'u_center'), [worldX, worldY]);
        gl.uniform1f(gl.getUniformLocation(this.programs.splat, 'u_radius'), radius);
        gl.uniform1f(gl.getUniformLocation(this.programs.splat, 'u_amount'), amount);

        // Render into terrainB then swap
        this.runPass(this.programs.splat, { u_terrain: this.textures.terrainA }, this.textures.terrainB, {});
        this.swap('terrain');
    }

    // Add a constant delta to the terrain texture at world coordinates (x,y).
    // worldX/worldY are in terrain texel space (0..size-1).
    addTerrainAt(worldX, worldY, delta) {
        const gl = this.gl;
        const ix = Math.floor(worldX);
        const iy = Math.floor(worldY);
        if (ix < 0 || ix >= this.size || iy < 0 || iy >= this.size) return null;

        // Bind framebuffer and attach terrain texture so we can read the pixel
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.sim);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.terrainA, 0);
        gl.viewport(0, 0, this.size, this.size);

        const px = new Float32Array(4);
        gl.readPixels(ix, iy, 1, 1, gl.RGBA, gl.FLOAT, px);

        px[0] = px[0] + delta;

        // Write back the modified pixel into the texture
        gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, ix, iy, 1, 1, gl.RGBA, gl.FLOAT, px);

        // Restore default framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        return px[0];
    }

    reset() {
        this.steps = 0;
        // Initialize terrain on CPU and upload
        // Or write a terrain generation shader.
        // For now, let's reuse the CPU generation logic and upload it.

        const size = this.size;
        const terrainData = new Float32Array(size * size * 4);
        const waterData = new Float32Array(size * size * 4); // Zeroed

        // Reuse fBm logic
        const LACUNARITY = 1.9;
        const GAIN = this.params.gain;
        const GLOBAL_AMP = this.params.amp;
        const SLOPE_MAG = this.params.slopeMag || 0;
        const SLOPE_DIR = (this.params.slopeDir || 0) * Math.PI / 180.0; // Degrees to radians
        const ROTATION_ANGLE = 1.0;
        const COS_R = Math.cos(ROTATION_ANGLE);
        const SIN_R = Math.sin(ROTATION_ANGLE);

        // Seeded RNG
        let seed = this.params.seed;
        if (typeof seed === 'string') {
            let h = 0x811c9dc5;
            for (let i = 0; i < seed.length; i++) {
                h ^= seed.charCodeAt(i);
                h = Math.imul(h, 0x01000193);
            }
            seed = h >>> 0;
        }
        
        const mulberry32 = (a) => {
            return () => {
                let t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        };
        const random = mulberry32(seed);

        // Permutation table
        const perm = new Uint8Array(512);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 0; i < 256; i++) {
            const j = Math.floor(random() * 256);
            const t = perm[i];
            perm[i] = perm[j];
            perm[j] = t;
        }
        for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];

        const noise = (x, y) => {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            x -= Math.floor(x); y -= Math.floor(y);
            const u = x * x * (3 - 2 * x);
            const v = y * y * (3 - 2 * y);
            const aa = perm[perm[X] + Y] / 255.0;
            const ab = perm[perm[X] + Y + 1] / 255.0;
            const ba = perm[perm[X + 1] + Y] / 255.0;
            const bb = perm[perm[X + 1] + Y + 1] / 255.0;
            return (aa * (1 - u) + ba * u) * (1 - v) + (ab * (1 - u) + bb * u) * v;
        };

        const fBm = (x, y, octaves) => {
            let val = 0; let amp = 0.5; let totalAmp = 0;
            let nx = x; let ny = y;
            for (let i = 0; i < octaves; i++) {
                val += noise(nx, ny) * amp;
                totalAmp += amp;
                nx *= LACUNARITY; ny *= LACUNARITY;
                const rx = nx * COS_R - ny * SIN_R;
                const ry = nx * SIN_R + ny * COS_R;
                nx = rx; ny = ry;
                amp *= GAIN;
            }
            return val / totalAmp;
        };

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const domainScale = 5.12;
                const nx = x / size;
                const ny = y / size;
                const h = fBm(nx * domainScale, ny * domainScale, this.params.octaves);
                
                // Apply slope
                // Center coordinates for rotation
                const cx = nx - 0.5;
                const cy = ny - 0.5;
                const slope = (cx * Math.cos(SLOPE_DIR) + cy * Math.sin(SLOPE_DIR)) * SLOPE_MAG * size; // Scale slope to match terrain scale roughly

                const shapedH = h * GLOBAL_AMP + slope;

                terrainData[i] = shapedH;
                terrainData[i + 1] = 0; terrainData[i + 2] = 0; terrainData[i + 3] = 1;

                // Initial Water
                const waterLevel = this.params.initialWaterLevel || 0;
                const w = Math.max(0, waterLevel * GLOBAL_AMP - shapedH);
                waterData[i] = w;
            }
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, terrainData);

        gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainB);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, terrainData);

        gl.bindTexture(gl.TEXTURE_2D, this.textures.waterA);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, waterData);

        gl.bindTexture(gl.TEXTURE_2D, this.textures.waterB);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, waterData);

        // Clear other textures
        const clearData = new Float32Array(size * size * 4);
        const texs = [this.textures.sedimentA, this.textures.sedimentB, this.textures.fluxA, this.textures.fluxB, this.textures.velocity];
        texs.forEach(t => {
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, clearData);
        });
    }

    runPass(program, inputs, output, uniforms) {
        const gl = this.gl;
        gl.useProgram(program);

        // Bind inputs
        let unit = 0;
        for (const name in inputs) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, inputs[name]);
            gl.uniform1i(gl.getUniformLocation(program, name), unit);
            unit++;
        }

        // Bind uniforms
        for (const name in uniforms) {
            const loc = gl.getUniformLocation(program, name);
            const val = uniforms[name];
            if (Array.isArray(val)) {
                if (val.length === 2) gl.uniform2fv(loc, val);
            } else {
                gl.uniform1f(loc, val);
            }
        }

        // Bind output framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.sim);
        if (Array.isArray(output)) {
            const buffers = [];
            for (let i = 0; i < output.length; i++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, output[i], 0);
                buffers.push(gl.COLOR_ATTACHMENT0 + i);
            }
            gl.drawBuffers(buffers);
        } else {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
            // Unbind attachment 1 to prevent feedback loops
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        }

        gl.viewport(0, 0, this.size, this.size);

        // Draw
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    step() {
        this.steps++;
        const p = this.params;

        // 1. Rain (WaterA -> WaterB)
        this.runPass(this.programs.rain, { u_water: this.textures.waterA }, this.textures.waterB, {
            u_rainRate: p.rainRate,
            u_dt: p.dt
        });
        this.swap('water');

        // 2. Flux (FluxA -> FluxB)
        this.runPass(this.programs.flux, {
            u_terrain: this.textures.terrainA,
            u_water: this.textures.waterA,
            u_sediment: this.textures.sedimentA,
            u_flux: this.textures.fluxA
        }, this.textures.fluxB, {
            u_dt: p.dt,
            u_gravity: p.gravity,
            u_pipeLength: p.pipeLength,
            u_size: [this.size, this.size]
        });
        this.swap('flux');

        // 3. Water Update (WaterA -> WaterB)
        this.runPass(this.programs.water, {
            u_water: this.textures.waterA,
            u_sediment: this.textures.sedimentA,
            u_flux: this.textures.fluxA
        }, [this.textures.waterB, this.textures.sedimentB], {
            u_dt: p.dt,
            u_evapRate: p.evaporationRate,
            u_size: [this.size, this.size]
        });
        this.swap('water');
        this.swap('sediment');

        // 4. Velocity (Velocity)
        this.runPass(this.programs.velocity, {
            u_water: this.textures.waterA,
            u_flux: this.textures.fluxA
        }, this.textures.velocity, {
            u_size: [this.size, this.size]
        });

        // 5. Erosion (TerrainA, SedimentA -> TerrainB, SedimentB)
        this.runPass(this.programs.erosion, {
            u_terrain: this.textures.terrainA,
            u_sediment: this.textures.sedimentA,
            u_velocity: this.textures.velocity
        }, [this.textures.terrainB, this.textures.sedimentB], {
            u_dt: p.dt,
            u_erosionRate: p.erosionRate,
            u_depositionRate: p.depositionRate,
        });
        this.swap('terrain');
        this.swap('sediment');
    }

    swap(name) {
        const temp = this.textures[name + 'A'];
        this.textures[name + 'A'] = this.textures[name + 'B'];
        this.textures[name + 'B'] = temp;
    }

    draw(viewMode) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.useProgram(this.programs.render);

        // Bind textures
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.uniform1i(gl.getUniformLocation(this.programs.render, 'u_terrain'), 0);

        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures.waterA);
        gl.uniform1i(gl.getUniformLocation(this.programs.render, 'u_water'), 1);

        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.textures.sedimentA);
        gl.uniform1i(gl.getUniformLocation(this.programs.render, 'u_sediment'), 2);

        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.textures.velocity);
        gl.uniform1i(gl.getUniformLocation(this.programs.render, 'u_velocity'), 3);

        // View mode
        let mode = 0;
        if (viewMode === 'terrain') mode = 0;
        else if (viewMode === 'height') mode = 1;
        else if (viewMode === 'water') mode = 2;
        else if (viewMode === 'sediment') mode = 3;
        else if (viewMode === 'velocity') mode = 4;

        gl.uniform1i(gl.getUniformLocation(this.programs.render, 'u_viewMode'), mode);
        gl.uniform1f(gl.getUniformLocation(this.programs.render, 'u_viewSensitivity'), this.params.viewSensitivity);
        gl.uniform2fv(gl.getUniformLocation(this.programs.render, 'u_size'), [this.size, this.size]);
        gl.uniform2fv(gl.getUniformLocation(this.programs.render, 'u_resolution'), [this.canvas.width, this.canvas.height]);
        
        gl.uniform3fv(gl.getUniformLocation(this.programs.render, 'u_cameraPos'), this.params.cameraPos);
        gl.uniform3fv(gl.getUniformLocation(this.programs.render, 'u_cameraTarget'), this.params.cameraTarget);
        gl.uniform1f(gl.getUniformLocation(this.programs.render, 'u_fov'), this.params.fov);
        gl.uniform1f(gl.getUniformLocation(this.programs.render, 'u_cameraRoll'), this.params.cameraRoll);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    calculateStats() {
        const gl = this.gl;
        gl.useProgram(this.programs.stats);

        // Bind inputs
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures.terrainA);
        gl.uniform1i(gl.getUniformLocation(this.programs.stats, 'u_terrain'), 0);

        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures.waterA);
        gl.uniform1i(gl.getUniformLocation(this.programs.stats, 'u_water'), 1);

        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.textures.sedimentA);
        gl.uniform1i(gl.getUniformLocation(this.programs.stats, 'u_sediment'), 2);

        gl.uniform2fv(gl.getUniformLocation(this.programs.stats, 'u_resolution'), [this.size, this.size]);
        gl.uniform2fv(gl.getUniformLocation(this.programs.stats, 'u_targetResolution'), [this.statsSize, this.statsSize]);

        // Bind output
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.stats);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.stats, 0);
        gl.viewport(0, 0, this.statsSize, this.statsSize);

        // Draw
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Read pixels
        const pixels = new Float32Array(this.statsSize * this.statsSize * 4);
        gl.readPixels(0, 0, this.statsSize, this.statsSize, gl.RGBA, gl.FLOAT, pixels);

        // Sum on CPU
        let totalTerrain = 0;
        let totalWater = 0;
        let totalSediment = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            totalTerrain += pixels[i];
            totalWater += pixels[i + 1];
            totalSediment += pixels[i + 2];
        }

        return {
            terrain: totalTerrain,
            water: totalWater,
            sediment: totalSediment
        };
    }
}
