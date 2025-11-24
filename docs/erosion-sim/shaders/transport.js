export const TRANSPORT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_sediment;   // Suspended sediment amount (equivalent height in meters)
uniform sampler2D u_velocity;   // Water velocity field (m/s)
uniform float u_dt;             // Time step (s)
uniform vec2 u_size;            // Grid dimensions (cells)

out vec4 outColor;

void main() {
    // copy sediment from previous (backtraced) position to current position
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
