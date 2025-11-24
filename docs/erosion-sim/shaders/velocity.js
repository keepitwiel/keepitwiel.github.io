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
