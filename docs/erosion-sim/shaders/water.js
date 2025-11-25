export const WATER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;    // water depth (m)
uniform sampler2D u_sediment; // sediment depth (m)
uniform sampler2D u_flux;     // Fluid Flow rate (m/s)
uniform float u_dt;           // time step (s)
uniform float u_evapRate;     // evaporation rate (m/s)
uniform vec2 u_size;

layout(location = 0) out vec4 outWater;
layout(location = 1) out vec4 outSediment;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 size = u_size;
    
    float w = texelFetch(u_water, coord, 0).r;    // water height (m)
    float s = texelFetch(u_sediment, coord, 0).r; // sediment height (m)
    vec4 flux = texelFetch(u_flux, coord, 0);     // fluid flux out (m/s)
    
    // Calculate local concentration
    float totalFluid = w + s;
    float concentration = (totalFluid > 0.000001) ? s / totalFluid : 0.0;
    
    // Outflow
    float outFlow = flux.x + flux.y + flux.z + flux.w; // Total fluid leaving (m/s)
    float sOut = outFlow * concentration;
    float wOut = outFlow * (1.0 - concentration);
    
    // Inflow
    // We need to sample neighbors to get their flux AND their concentration
    
    // Left Neighbor (Flux to Right enters here)
    float sIn = 0.0;
    float wIn = 0.0;
    
    if (coord.x > 0) {
        ivec2 n = coord + ivec2(-1, 0);
        float fluxIn = texelFetch(u_flux, n, 0).y; // Right flux of left neighbor
        float nw = texelFetch(u_water, n, 0).r;
        float ns = texelFetch(u_sediment, n, 0).r;
        float nTotal = nw + ns;
        float nConc = (nTotal > 0.000001) ? ns / nTotal : 0.0;
        sIn += fluxIn * nConc;
        wIn += fluxIn * (1.0 - nConc);
    }
    
    // Right Neighbor (Flux to Left enters here)
    if (coord.x < int(size.x) - 1) {
        ivec2 n = coord + ivec2(1, 0);
        float fluxIn = texelFetch(u_flux, n, 0).x; // Left flux of right neighbor
        float nw = texelFetch(u_water, n, 0).r;
        float ns = texelFetch(u_sediment, n, 0).r;
        float nTotal = nw + ns;
        float nConc = (nTotal > 0.000001) ? ns / nTotal : 0.0;
        sIn += fluxIn * nConc;
        wIn += fluxIn * (1.0 - nConc);
    }
    
    // Top Neighbor (Flux to Bottom enters here)
    if (coord.y > 0) {
        ivec2 n = coord + ivec2(0, -1);
        float fluxIn = texelFetch(u_flux, n, 0).w; // Bottom flux of top neighbor
        float nw = texelFetch(u_water, n, 0).r;
        float ns = texelFetch(u_sediment, n, 0).r;
        float nTotal = nw + ns;
        float nConc = (nTotal > 0.000001) ? ns / nTotal : 0.0;
        sIn += fluxIn * nConc;
        wIn += fluxIn * (1.0 - nConc);
    }
    
    // Bottom Neighbor (Flux to Top enters here)
    if (coord.y < int(size.y) - 1) {
        ivec2 n = coord + ivec2(0, 1);
        float fluxIn = texelFetch(u_flux, n, 0).z; // Top flux of bottom neighbor
        float nw = texelFetch(u_water, n, 0).r;
        float ns = texelFetch(u_sediment, n, 0).r;
        float nTotal = nw + ns;
        float nConc = (nTotal > 0.000001) ? ns / nTotal : 0.0;
        sIn += fluxIn * nConc;
        wIn += fluxIn * (1.0 - nConc);
    }
    
    // Update
    float newW = max(0.0, w + u_dt * (wIn - wOut));
    float newS = max(0.0, s + u_dt * (sIn - sOut));
    
    // Evaporation (only affects water)
    newW = max(0.0, newW - u_evapRate * u_dt);
    
    outWater = vec4(newW, 0.0, 0.0, 1.0);
    outSediment = vec4(newS, 0.0, 0.0, 1.0);
}`;
