export const SPLAT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_terrain;
uniform vec2 u_center; // texel coordinates
uniform float u_radius; // texel units
uniform float u_amount; // amount to add to R channel

out vec4 outColor;

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec2 p = vec2(coord);
    float dist = distance(p, u_center);

    vec4 t = texelFetch(u_terrain, coord, 0);
    float add = 0.0;
    if (dist <= u_radius) {
        // Smooth falloff: linear from center to radius
        float f = 1.0 - (dist / u_radius);
        add = u_amount * f;
    }

    outColor = vec4(t.r + add, t.g, t.b, t.a);
}
`;