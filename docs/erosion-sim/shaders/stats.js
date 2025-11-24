export const STATS_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_water;
uniform sampler2D u_sediment;
uniform vec2 u_resolution; // Source resolution
uniform vec2 u_targetResolution; // Target resolution

out vec4 outColor;

void main() {
    ivec2 targetCoord = ivec2(gl_FragCoord.xy);
    vec2 ratio = u_resolution / u_targetResolution;
    
    vec2 start = vec2(targetCoord) * ratio;
    vec2 end = start + ratio;
    
    vec3 sum = vec3(0.0);
    
    // Loop over the block
    // We use a fixed loop size based on ratio to avoid dynamic loop issues if possible,
    // but ratio is uniform so it should be fine in WebGL2.
    for (float y = start.y; y < end.y; y += 1.0) {
        for (float x = start.x; x < end.x; x += 1.0) {
            ivec2 coord = ivec2(x, y);
            // Clamp to source size
            if (coord.x >= int(u_resolution.x) || coord.y >= int(u_resolution.y)) continue;
            
            float t = texelFetch(u_terrain, coord, 0).r;
            float w = texelFetch(u_water, coord, 0).r;
            float s = texelFetch(u_sediment, coord, 0).r;
            sum += vec3(t, w, s);
        }
    }
    
    outColor = vec4(sum, 1.0);
}`;
