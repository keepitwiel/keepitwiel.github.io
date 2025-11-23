export const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
    gl_Position = a_position;
}`;

export const RAIN_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;
uniform float u_rainRate;
uniform float u_dt;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    float water = texelFetch(u_water, coord, 0).r;
    outColor = vec4(water + u_rainRate * u_dt, 0.0, 0.0, 1.0);
}`;

export const FLUX_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_water;
uniform sampler2D u_flux;
uniform float u_dt;
uniform float u_gravity;
uniform float u_pipeLength;
uniform vec2 u_size;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float t = texelFetch(u_terrain, coord, 0).r;
    float w = texelFetch(u_water, coord, 0).r;
    float h = t + w;
    
    vec4 flux = texelFetch(u_flux, coord, 0);
    
    // Neighbors: Left, Right, Top, Bottom
    // We need to handle boundaries carefully
    float hL = (coord.x > 0) ? texelFetch(u_terrain, coord + ivec2(-1, 0), 0).r + texelFetch(u_water, coord + ivec2(-1, 0), 0).r : h;
    float hR = (coord.x < int(size.x) - 1) ? texelFetch(u_terrain, coord + ivec2(1, 0), 0).r + texelFetch(u_water, coord + ivec2(1, 0), 0).r : h;
    float hT = (coord.y > 0) ? texelFetch(u_terrain, coord + ivec2(0, -1), 0).r + texelFetch(u_water, coord + ivec2(0, -1), 0).r : h;
    float hB = (coord.y < int(size.y) - 1) ? texelFetch(u_terrain, coord + ivec2(0, 1), 0).r + texelFetch(u_water, coord + ivec2(0, 1), 0).r : h;
    
    // Calculate new flux
    // Flux = max(0, Flux + dt * A * g * dh / l)
    // A = pipe cross section area. Let's assume pipe area is proportional to water height or constant.
    // The standard pipe model uses A = pipe_area. Let's use a constant factor for now.
    float factor = u_dt * u_gravity / u_pipeLength;
    
    vec4 dH = vec4(h - hL, h - hR, h - hT, h - hB);
    vec4 newFlux = max(vec4(0.0), flux + factor * dH);
    
    // Scaling
    float sum = newFlux.x + newFlux.y + newFlux.z + newFlux.w;
    float maxOut = w * u_pipeLength * u_pipeLength / u_dt; // Max volume that can leave? 
    // Actually, K = min(1, water / (sum * dt))
    
    float K = 1.0;
    if (sum * u_dt > w) {
        K = w / (sum * u_dt);
    }
    
    outColor = newFlux * K;
}`;

export const WATER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;
uniform sampler2D u_flux;
uniform float u_dt;
uniform float u_evapRate;
uniform vec2 u_size;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float w = texelFetch(u_water, coord, 0).r;
    vec4 flux = texelFetch(u_flux, coord, 0);
    
    float outFlow = flux.x + flux.y + flux.z + flux.w;
    
    // Inflow
    float inL = (coord.x > 0) ? texelFetch(u_flux, coord + ivec2(-1, 0), 0).y : 0.0; // Right flux of left neighbor
    float inR = (coord.x < int(size.x) - 1) ? texelFetch(u_flux, coord + ivec2(1, 0), 0).x : 0.0; // Left flux of right neighbor
    float inT = (coord.y > 0) ? texelFetch(u_flux, coord + ivec2(0, -1), 0).w : 0.0; // Bottom flux of top neighbor
    float inB = (coord.y < int(size.y) - 1) ? texelFetch(u_flux, coord + ivec2(0, 1), 0).z : 0.0; // Top flux of bottom neighbor
    
    float inFlow = inL + inR + inT + inB;
    
    float dw = u_dt * (inFlow - outFlow);
    float newW = max(0.0, w + dw);
    
    // Evaporation
    // Physically correct: subtract constant depth based on rate * time
    newW = max(0.0, newW - u_evapRate * u_dt);
    
    outColor = vec4(newW, 0.0, 0.0, 1.0);
}`;

export const VELOCITY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;
uniform sampler2D u_flux;
uniform vec2 u_size;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float w = texelFetch(u_water, coord, 0).r;
    vec4 f = texelFetch(u_flux, coord, 0);
    
    // Inflow fluxes
    float inL = (coord.x > 0) ? texelFetch(u_flux, coord + ivec2(-1, 0), 0).y : 0.0;
    float inR = (coord.x < int(size.x) - 1) ? texelFetch(u_flux, coord + ivec2(1, 0), 0).x : 0.0;
    float inT = (coord.y > 0) ? texelFetch(u_flux, coord + ivec2(0, -1), 0).w : 0.0;
    float inB = (coord.y < int(size.y) - 1) ? texelFetch(u_flux, coord + ivec2(0, 1), 0).z : 0.0;
    
    // Average flux
    // u = (inL - outL + outR - inR) / 2
    float fluxX = (inL - f.x + f.y - inR) * 0.5;
    float fluxY = (inT - f.z + f.w - inB) * 0.5;
    
    // Velocity = Flux / Depth (avoid div by zero)
    float d = max(0.001, w);
    float u = fluxX / d;
    float v = fluxY / d;
    
    outColor = vec4(u, v, 0.0, 1.0);
}`;

export const EROSION_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform float u_dt;
uniform float u_erosionRate;
uniform float u_depositionRate;
uniform float u_ravineErosionThreshold;
uniform float u_ravineErosionRate;

layout(location = 0) out vec4 outTerrain;
layout(location = 1) out vec4 outSediment;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    
    float t = texelFetch(u_terrain, coord, 0).r;
    float s = texelFetch(u_sediment, coord, 0).r;
    vec2 v = texelFetch(u_velocity, coord, 0).xy;
    
    float speed = length(v);
    float capacity = u_erosionRate * speed; // Kc * v
    
    float diff = capacity - s;
    
    float newT = t;
    float newS = s;

    // Thermal Erosion (Diffusion)
    ivec2 size = textureSize(u_terrain, 0);
    float tL = (coord.x > 0) ? texelFetch(u_terrain, coord + ivec2(-1, 0), 0).r : t;
    float tR = (coord.x < size.x - 1) ? texelFetch(u_terrain, coord + ivec2(1, 0), 0).r : t;
    float tT = (coord.y > 0) ? texelFetch(u_terrain, coord + ivec2(0, -1), 0).r : t;
    float tB = (coord.y < size.y - 1) ? texelFetch(u_terrain, coord + ivec2(0, 1), 0).r : t;

    vec4 neighbors = vec4(tL, tR, tT, tB);
    vec4 heightDiffs = neighbors - t;
    vec4 transfer = sign(heightDiffs) * max(vec4(0.0), abs(heightDiffs) - u_ravineErosionThreshold);
    newT += dot(transfer, vec4(u_ravineErosionRate * u_dt));
    
    if (diff > 0.0) {
        // Erode
        float amount = u_erosionRate * diff * u_dt;
        newT -= amount;
        newS += amount;
    } else {
        // Deposit
        float amount = u_depositionRate * (-diff) * u_dt;
        newT += amount;
        newS -= amount;
    }
    
    outTerrain = vec4(newT, 0.0, 0.0, 1.0);
    outSediment = vec4(newS, 0.0, 0.0, 1.0);
}`;

export const TRANSPORT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform float u_dt;
uniform vec2 u_size;

out vec4 outColor;

void main() {
    vec2 coord = gl_FragCoord.xy;
    vec2 size = u_size;
    
    vec2 v = texture(u_velocity, coord / size).xy;
    
    // Backtrace
    vec2 oldPos = coord - v * u_dt;
    
    // Interpolate
    // texture() uses normalized coordinates 0..1
    float s = texture(u_sediment, oldPos / size).r;
    
    outColor = vec4(s, 0.0, 0.0, 1.0);
}`;

export const RENDER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_water;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform vec2 u_size; // Simulation size
uniform vec2 u_resolution; // Canvas resolution
uniform int u_viewMode; // 0: Composite, 1: Height, 2: Water, 3: Sediment, 4: Velocity
uniform float u_viewSensitivity;

// Camera uniforms
uniform vec3 u_cameraPos;
uniform vec3 u_cameraTarget;
uniform float u_fov;
uniform float u_cameraRoll;

out vec4 outColor;

const vec3 lightOrange = vec3(1.0, 0.6, 0.2);
const vec3 darkBlue = vec3(0.0, 0.1, 0.4);

const int COMPOSITE_VIEW = 0;
const int HEIGHT_VIEW = 1;
const int WATER_VIEW = 2;
const int SEDIMENT_VIEW = 3;
const int VELOCITY_VIEW = 4;

// Raymarching constants
const int MAX_STEPS = 256;
const float MAX_DIST = 4000.0;
const float MIN_DIST = 0.1;

float getTerrainHeight(vec2 p) {
    // Check bounds
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return -100.0;
    return texelFetch(u_terrain, ivec2(p), 0).r;
}

float getWaterHeight(vec2 p) {
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return 0.0;
    return texelFetch(u_water, ivec2(p), 0).r;
}

float getSediment(vec2 p) {
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return 0.0;
    return texelFetch(u_sediment, ivec2(p), 0).r;
}

vec2 boxIntersection(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
    vec3 m = 1.0 / rd;
    vec3 n = m * ro;
    vec3 k = abs(m) * (boxMax - boxMin);
    vec3 t1 = -n - k * 0.5;
    vec3 t2 = -n + k * 0.5; // This is wrong, standard slab method:
    
    vec3 tMin = (boxMin - ro) * m;
    vec3 tMax = (boxMax - ro) * m;
    vec3 t1_ = min(tMin, tMax);
    vec3 t2_ = max(tMin, tMax);
    float tN = max(max(t1_.x, t1_.y), t1_.z);
    float tF = min(min(t2_.x, t2_.y), t2_.z);
    if (tN > tF || tF < 0.0) return vec2(-1.0);
    return vec2(tN, tF);
}

vec3 getNormal(vec2 p) {
    float h = getTerrainHeight(p);
    float hL = getTerrainHeight(p + vec2(-1, 0));
    float hR = getTerrainHeight(p + vec2(1, 0));
    float hT = getTerrainHeight(p + vec2(0, -1));
    float hB = getTerrainHeight(p + vec2(0, 1));
    return normalize(vec3(hL - hR, hT - hB, 2.0));
}

void main() {
    if (u_viewMode == COMPOSITE_VIEW) {
        // 3D Raymarching
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
        
        // Camera setup
        vec3 ro = u_cameraPos;
        vec3 ta = u_cameraTarget;
        
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0.0, 0.0, 1.0)));
        vec3 vv = normalize(cross(uu, ww));
        
        // Apply roll
        float ca = cos(u_cameraRoll);
        float sa = sin(u_cameraRoll);
        vec3 nu = ca * uu + sa * vv;
        vec3 nv = -sa * uu + ca * vv;
        uu = nu; vv = nv;
        
        float f = 1.0 / tan(radians(u_fov) * 0.5);
        vec3 rd = normalize(uv.x * uu + uv.y * vv + f * ww);
        
        vec3 col = vec3(0.5, 0.7, 0.9); // Sky
        
        // Intersect bounding box
        // Terrain is 0..size.x, 0..size.y. Height is roughly -50..200?
        vec3 boxMin = vec3(0.0, 0.0, -100.0);
        vec3 boxMax = vec3(u_size.x, u_size.y, 300.0);
        
        vec2 tBox = boxIntersection(ro, rd, boxMin, boxMax);
        
        if (tBox.y > 0.0) {
            float t = max(0.0, tBox.x);
            float tMax = tBox.y;
            
            // Dither start to reduce banding
            // t += fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 0.5;

            bool hit = false;
            vec3 p;
            
            for(int i = 0; i < MAX_STEPS; i++) {
                p = ro + rd * t;
                if (t > tMax) break;
                
                float h = getTerrainHeight(p.xy);
                float w = getWaterHeight(p.xy);
                float surfaceH = h + w;
                
                if (p.z < surfaceH) {
                    hit = true;
                    // Binary search refinement
                    float t0 = t - 1.0; // Assume step was small enough or backtrack
                    // Actually, we should store prevT.
                    // Simple linear interpolation refinement
                    // p_prev was above, p is below.
                    // Let's just take p as hit for now or do one step back
                    t -= 0.5;
                    p = ro + rd * t;
                    break;
                }
                
                // Step size
                // If we are high above, step larger
                float heightDiff = p.z - surfaceH;
                float dt = max(1.0, heightDiff * 0.4);
                t += dt;
            }
            
            if (hit) {
                // Shading
                float h = getTerrainHeight(p.xy);
                float w = getWaterHeight(p.xy);
                float s = getSediment(p.xy);
                
                vec3 n = getNormal(p.xy);
                vec3 lightDir = normalize(vec3(-1.0, -1.0, 1.0));
                float diff = max(0.0, dot(n, lightDir));
                float ambient = 0.2;
                
                // Terrain color
                float hNorm = h / 100.0;
                vec3 terrainColor;
                if (hNorm < 0.3) terrainColor = vec3(0.2, 0.6, 0.2);
                else if (hNorm < 0.7) terrainColor = vec3(0.4, 0.4, 0.3);
                else terrainColor = vec3(0.8, 0.8, 0.8);
                
                col = terrainColor * (ambient + diff);
                
                // Water
                if (w > 0.01) {
                    float depth = min(1.0, w * 0.5);
                    float sed = min(1.0, s * 5.0);
                    vec3 waterColor = mix(vec3(0.2, 0.4, 0.8), vec3(0.4, 0.3, 0.1), sed);
                    
                    // Water normal (flat for now, or perturbed)
                    vec3 wn = vec3(0.0, 0.0, 1.0);
                    float wDiff = max(0.0, dot(wn, lightDir));
                    float wSpec = pow(max(0.0, dot(reflect(-lightDir, wn), -rd)), 50.0);
                    
                    float alpha = min(0.9, 0.3 + depth * 0.6);
                    col = mix(col, waterColor * (ambient + wDiff) + vec3(wSpec), alpha);
                }
                
                // Fog
                float fog = 1.0 - exp(-t * 0.0005);
                col = mix(col, vec3(0.5, 0.7, 0.9), fog);
            }
        }
        
        outColor = vec4(col, 1.0);
        
    } else {
        // 2D Views
        vec2 uv = gl_FragCoord.xy / u_size;
        ivec2 coord = ivec2(gl_FragCoord.xy);
        
        float h = texelFetch(u_terrain, coord, 0).r;
        float w = texelFetch(u_water, coord, 0).r;
        float s = texelFetch(u_sediment, coord, 0).r;
        vec2 v = texelFetch(u_velocity, coord, 0).xy;
        
        vec3 color = vec3(0.0);
        
        if (u_viewMode == HEIGHT_VIEW) {
            float val = h / 100.0;
            color = vec3(val);
        } else if (u_viewMode == WATER_VIEW) {
            if (w < u_viewSensitivity) {
                color = mix(vec3(0.0), lightOrange, w / u_viewSensitivity);
            } else {
                float t = 1.0 - exp(-(w - u_viewSensitivity) * u_viewSensitivity);
                color = mix(lightOrange, darkBlue, t);
            }
        } else if (u_viewMode == SEDIMENT_VIEW) {
            float val = s * u_viewSensitivity * 100.0;
            color = vec3(val, val * 0.5, 0.0);
        } else if (u_viewMode == VELOCITY_VIEW) {
            vec2 vn = v * u_viewSensitivity;
            color = vec3(length(vn), 0.5 + vn.x, 0.5 + vn.y);
        }
        
        outColor = vec4(color, 1.0);
    }
}`;
