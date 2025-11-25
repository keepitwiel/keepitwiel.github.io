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
    float capacity = min(10.0, u_erosionRate * speed); // Kc * v. capped to prevent runaway erosion

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
