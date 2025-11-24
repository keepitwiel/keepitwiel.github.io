export const WATER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;  // water depth (m)
uniform sampler2D u_flux;   // Flow rate (m/s) - represents change in water column height per second
uniform float u_dt;         // time step (s)
uniform float u_evapRate;   // evaporation rate (m/s) - represents change in water column height per second
uniform vec2 u_size;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float w = texelFetch(u_water, coord, 0).r;  // water height (m)
    vec4 flux = texelFetch(u_flux, coord, 0);   // change in water height (m/s)
    
    float outFlow = flux.x + flux.y + flux.z + flux.w;  // m/s
    
    // Inflow
    float inL = (coord.x > 0) ? texelFetch(u_flux, coord + ivec2(-1, 0), 0).y : 0.0; // Right flux of left neighbor
    float inR = (coord.x < int(size.x) - 1) ? texelFetch(u_flux, coord + ivec2(1, 0), 0).x : 0.0; // Left flux of right neighbor
    float inT = (coord.y > 0) ? texelFetch(u_flux, coord + ivec2(0, -1), 0).w : 0.0; // Bottom flux of top neighbor
    float inB = (coord.y < int(size.y) - 1) ? texelFetch(u_flux, coord + ivec2(0, 1), 0).z : 0.0; // Top flux of bottom neighbor
    
    float inFlow = inL + inR + inT + inB;   // m/s
    
    float dw = u_dt * (inFlow - outFlow);   // m
    float newW = max(0.0, w + dw);          // m
    
    // Evaporation
    // Physically correct: subtract constant depth based on rate * time
    newW = max(0.0, newW - u_evapRate * u_dt);  // m
    
    outColor = vec4(newW, 0.0, 0.0, 1.0);   // m
}`;
