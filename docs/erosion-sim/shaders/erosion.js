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
