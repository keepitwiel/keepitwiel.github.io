export const FLUX_SHADER = `#version 300 es
precision highp float;

// Inputs
uniform sampler2D u_terrain; // Terrain height (m)
uniform sampler2D u_water;   // Water depth (m)
uniform sampler2D u_flux;    // Flow rate (m/s) - represents change in water column height per second

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
    float h = t + w;                             // Total height (m)
    
    vec4 flux = texelFetch(u_flux, coord, 0);    // Current flux L, R, T, B (m/s)
    
    // Neighbors: Left, Right, Top, Bottom
    // We need to handle boundaries carefully
    float hL = (coord.x > 0) ? texelFetch(u_terrain, coord + ivec2(-1, 0), 0).r + texelFetch(u_water, coord + ivec2(-1, 0), 0).r : h;
    float hR = (coord.x < int(size.x) - 1) ? texelFetch(u_terrain, coord + ivec2(1, 0), 0).r + texelFetch(u_water, coord + ivec2(1, 0), 0).r : h;
    float hT = (coord.y > 0) ? texelFetch(u_terrain, coord + ivec2(0, -1), 0).r + texelFetch(u_water, coord + ivec2(0, -1), 0).r : h;
    float hB = (coord.y < int(size.y) - 1) ? texelFetch(u_terrain, coord + ivec2(0, 1), 0).r + texelFetch(u_water, coord + ivec2(0, 1), 0).r : h;
    
    // Calculate new flux
    // Flux represents the rate of water height change (m/s)
    // Standard pipe model: Q_new = Q_old + dt * A * g * dh / l
    // Dividing by cell area A (assuming A = l^2) gives: f_new = f_old + dt * g * dh / l
    // Units: (m/s) = (m/s) + (s) * (m/s^2) * (m) / (m)
    float factor = u_dt * u_gravity / u_pipeLength; // Factor units: (1/s)
    
    vec4 dH = vec4(h - hL, h - hR, h - hT, h - hB); // Height difference (m)
    vec4 newFlux = max(vec4(0.0), flux + factor * dH);
    
    // Scaling to ensure we don't output more water than we have
    float sum = newFlux.x + newFlux.y + newFlux.z + newFlux.w; // Total outflow rate (m/s)
    
    // K is a scaling factor (dimensionless)
    // If total outflow volume (sum * dt) > water volume (w), scale down
    float K = 1.0;
    if (sum * u_dt > w) {
        K = w / (sum * u_dt);
    }
    
    outColor = newFlux * K;
}`;
