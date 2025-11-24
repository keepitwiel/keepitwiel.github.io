export const RAIN_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_water;  // water depth (m)
uniform float u_rainRate;   // rate water column height increases (m/s)
uniform float u_dt;

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    float water = texelFetch(u_water, coord, 0).r; // water depth (m)
    outColor = vec4(water + u_rainRate * u_dt, 0.0, 0.0, 1.0);
}
`;
