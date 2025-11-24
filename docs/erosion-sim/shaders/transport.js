export const TRANSPORT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform float u_dt;
uniform vec2 u_size;

out vec4 outColor;

void main() {
    vec2 coord = gl_FragCoord.xy;
    vec2 size = u_size;
    
    vec2 v = texture(u_velocity, coord / size).xy;
    
    // Backtrace
    vec2 oldPos = coord - v * u_dt;
    
    // Interpolate
    // texture() uses normalized coordinates 0..1
    float s = texture(u_sediment, oldPos / size).r;
    
    outColor = vec4(s, 0.0, 0.0, 1.0);
}`;
