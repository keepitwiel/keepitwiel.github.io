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
