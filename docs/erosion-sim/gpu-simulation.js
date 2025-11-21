import * as Shaders from './shaders.js';

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
            pipeLength: 1.0,
            dt: 0.1,
            octaves: 10,
            initialWaterLevel: 0,
            viewSensitivity: 10,
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
        this.programs.transport = this.createProgram(vs, Shaders.TRANSPORT_SHADER);
        this.programs.render = this.createProgram(vs, Shaders.RENDER_SHADER);
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
    }

    initFramebuffers() {
        this.framebuffers.sim = this.gl.createFramebuffer();
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
        const GAIN = 1.0 / LACUNARITY;
        const ROTATION_ANGLE = 1.0;
        const COS_R = Math.cos(ROTATION_ANGLE);
        const SIN_R = Math.sin(ROTATION_ANGLE);

        // Permutation table
        const perm = new Uint8Array(512);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 0; i < 256; i++) {
            const j = Math.floor(Math.random() * 256);
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
                const shapedH = Math.pow(h, 2) * 100;

                terrainData[i] = shapedH;
                terrainData[i + 1] = 0; terrainData[i + 2] = 0; terrainData[i + 3] = 1;

                // Initial Water
                const waterLevel = this.params.initialWaterLevel || 0;
                const w = Math.max(0, waterLevel - shapedH);
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
            u_flux: this.textures.fluxA
        }, this.textures.waterB, {
            u_dt: p.dt,
            u_evapRate: p.evaporationRate,
            u_size: [this.size, this.size]
        });
        this.swap('water');

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
            u_depositionRate: p.depositionRate
        });
        this.swap('terrain');
        this.swap('sediment');

        // 6. Transport (SedimentA -> SedimentB)
        this.runPass(this.programs.transport, {
            u_sediment: this.textures.sedimentA,
            u_velocity: this.textures.velocity
        }, this.textures.sedimentB, {
            u_dt: p.dt,
            u_size: [this.size, this.size]
        });
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

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
