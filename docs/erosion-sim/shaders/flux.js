export const FLUX_SHADER = `#version 300 es
precision highp float;

// Inputs
uniform sampler2D u_terrain; // Terrain height (m)
uniform sampler2D u_water;   // Water depth (m)
uniform sampler2D u_sediment;// Sediment height (m)
uniform sampler2D u_flux;    // Flow rate (m/s) - represents change in fluid column height per second

// Physics Parameters
uniform float u_dt;          // Time step (s)
uniform float u_gravity;     // Gravity (m/s^2)
uniform float u_pipeLength;  // Pipe length / Grid spacing (m)
uniform vec2 u_size;         // Grid dimensions (pixels)

out vec4 outColor;           // New flux (m/s)

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float t = texelFetch(u_terrain, coord, 0).r; // Terrain height (m)
    float w = texelFetch(u_water, coord, 0).r;   // Water depth (m)
    float s = texelFetch(u_sediment, coord, 0).r;// Sediment height (m)
    float h = t + w + s;                         // Total height (m)
    
    vec4 flux = texelFetch(u_flux, coord, 0);    // Current flux L, R, T, B (m/s)
    
    // Neighbors: Left, Right, Top, Bottom
    // We need to handle boundaries carefully
    float hL = h; float hR = h; float hT = h; float hB = h;

    if (coord.x > 0) {
        hL = texelFetch(u_terrain, coord + ivec2(-1, 0), 0).r + 
             texelFetch(u_water, coord + ivec2(-1, 0), 0).r + 
             texelFetch(u_sediment, coord + ivec2(-1, 0), 0).r;
    }
    if (coord.x < int(size.x) - 1) {
        hR = texelFetch(u_terrain, coord + ivec2(1, 0), 0).r + 
             texelFetch(u_water, coord + ivec2(1, 0), 0).r + 
             texelFetch(u_sediment, coord + ivec2(1, 0), 0).r;
    }
    if (coord.y > 0) {
        hT = texelFetch(u_terrain, coord + ivec2(0, -1), 0).r + 
             texelFetch(u_water, coord + ivec2(0, -1), 0).r + 
             texelFetch(u_sediment, coord + ivec2(0, -1), 0).r;
    }
    if (coord.y < int(size.y) - 1) {
        hB = texelFetch(u_terrain, coord + ivec2(0, 1), 0).r + 
             texelFetch(u_water, coord + ivec2(0, 1), 0).r + 
             texelFetch(u_sediment, coord + ivec2(0, 1), 0).r;
    }
    
    // Calculate new flux
    // Flux represents the rate of fluid height change (m/s)
    float factor = u_dt * u_gravity / u_pipeLength; // Factor units: (1/s)
    
    vec4 dH = vec4(h - hL, h - hR, h - hT, h - hB); // Height difference (m)
    vec4 newFlux = max(vec4(0.0), flux + factor * dH);
    
    // Scaling to ensure we don't output more fluid than we have
    float sum = newFlux.x + newFlux.y + newFlux.z + newFlux.w; // Total outflow rate (m/s)
    
    // K is a scaling factor (dimensionless)
    // If total outflow volume (sum * dt) > fluid volume (w + s), scale down
    float totalFluid = w + s;
    float K = 1.0;
    if (sum * u_dt > totalFluid) {
        K = totalFluid / (sum * u_dt);
    }
    
    outColor = newFlux * K;
}`;
