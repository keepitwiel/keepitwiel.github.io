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
    newW *= (1.0 - u_evapRate * u_dt);
    
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
uniform vec2 u_size;
uniform int u_viewMode; // 0: Terrain, 1: Height, 2: Water, 3: Sediment, 4: Velocity
uniform float u_viewSensitivity;

out vec4 outColor;

const vec3 lightOrange = vec3(1.0, 0.6, 0.2);
const vec3 darkBlue = vec3(0.0, 0.1, 0.4);

void main() {
    vec2 uv = gl_FragCoord.xy / u_size;
    ivec2 coord = ivec2(gl_FragCoord.xy);
    
    float h = texelFetch(u_terrain, coord, 0).r;
    float w = texelFetch(u_water, coord, 0).r;
    float s = texelFetch(u_sediment, coord, 0).r;
    vec2 v = texelFetch(u_velocity, coord, 0).xy;
    
    vec3 color = vec3(0.0);
    
    if (u_viewMode == 0) {
        // Terrain + Hillshading
        // Calculate normal
        float hL = texelFetch(u_terrain, coord + ivec2(-1, 0), 0).r;
        float hR = texelFetch(u_terrain, coord + ivec2(1, 0), 0).r;
        float hT = texelFetch(u_terrain, coord + ivec2(0, -1), 0).r;
        float hB = texelFetch(u_terrain, coord + ivec2(0, 1), 0).r;
        
        float dx = hR - hL;
        float dy = hB - hT;
        float dz = 2.0;
        vec3 n = normalize(vec3(-dx, -dy, dz));
        
        vec3 lightDir = normalize(vec3(-1.0, -1.0, 1.0));
        float diff = max(0.0, dot(n, lightDir));
        float ambient = 0.2;
        float light = min(1.0, ambient + diff);
        
        // Base color
        float hNorm = h / 100.0;
        vec3 terrainColor;
        if (hNorm < 0.3) terrainColor = vec3(0.2, 0.6, 0.2);
        else if (hNorm < 0.7) terrainColor = vec3(0.4, 0.4, 0.3);
        else terrainColor = vec3(0.8, 0.8, 0.8);
        
        color = terrainColor * light;
        
        // Water
        if (w > 0.01) {
            float depth = min(1.0, w * 0.5);
            float sed = min(1.0, s * 5.0);
            vec3 waterColor = mix(vec3(0.2, 0.4, 0.8), vec3(0.4, 0.3, 0.1), sed);
            float alpha = min(0.9, 0.3 + depth * 0.6);
            
            // Specular
            float spec = pow(diff, 20.0) * 0.5 * alpha;
            
            color = mix(color, waterColor + spec, alpha);
        }
    } else if (u_viewMode == 1) {
        float val = h / 100.0;
        color = vec3(val);
    } else if (u_viewMode == 2) {
        if (w < u_viewSensitivity) {
            color = mix(vec3(0.0), lightOrange, w / u_viewSensitivity);
        } else {
            // Asymptotic transform: 0 at w=0.001, approaches 1 as w -> infinity
            float t = 1.0 - exp(-(w - u_viewSensitivity) * u_viewSensitivity);
            color = mix(lightOrange, darkBlue, t);
        }
    } else if (u_viewMode == 3) {
        float val = s * u_viewSensitivity;
        color = vec3(val, val * 0.5, 0.0);
    } else if (u_viewMode == 4) {
        vec2 vn = v * u_viewSensitivity;
        color = vec3(length(vn), 0.5 + vn.x, 0.5 + vn.y);
    }
    
    outColor = vec4(color, 1.0);
}`;
