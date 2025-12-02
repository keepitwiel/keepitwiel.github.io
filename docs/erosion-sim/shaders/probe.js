export const PROBE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_water;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform vec2 u_size; // Simulation size
uniform vec2 u_resolution; // Canvas resolution
uniform vec2 u_mouse; // Mouse position in pixel space (WebGL coordinates: origin bottom-left)
uniform int u_viewMode; // 0: Composite, 1: Height, 2: Water, 3: Sediment, 4: Velocity
uniform float u_viewSensitivity;

// Camera uniforms
uniform vec3 u_cameraPos;
uniform vec3 u_cameraTarget;
uniform float u_fov;
uniform float u_cameraRoll;

out vec4 outColor;

// Raymarching constants
const int MAX_STEPS = 256;
const float MAX_DIST = 4000.0;
const float MIN_DIST = 0.1;

float getTerrainHeight(vec2 p) {
    // Check bounds
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return -100.0;
    return texelFetch(u_terrain, ivec2(p), 0).r;
}

float getWaterHeight(vec2 p) {
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return 0.0;
    return texelFetch(u_water, ivec2(p), 0).r;
}

float getSediment(vec2 p) {
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return 0.0;
    return texelFetch(u_sediment, ivec2(p), 0).r;
}

vec2 boxIntersection(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
    vec3 m = 1.0 / rd;
    vec3 n = m * ro;
    vec3 k = abs(m) * (boxMax - boxMin);
    vec3 t1 = -n - k * 0.5;
    vec3 t2 = -n + k * 0.5; // This is wrong, standard slab method:
    
    vec3 tMin = (boxMin - ro) * m;
    vec3 tMax = (boxMax - ro) * m;
    vec3 t1_ = min(tMin, tMax);
    vec3 t2_ = max(tMin, tMax);
    float tN = max(max(t1_.x, t1_.y), t1_.z);
    float tF = min(min(t2_.x, t2_.y), t2_.z);
    if (tN > tF || tF < 0.0) return vec2(-1.0);
    return vec2(tN, tF);
}

bool rayMarch(vec2 tBox, vec3 ro, vec3 rd, out float t_out) {
    float t = max(0.0, tBox.x);
    float tMax = tBox.y;

    bool res = false;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        if (t > tMax) break;
        vec3 p = ro + rd * t;
        
        float h = getTerrainHeight(p.xy);
        float w = getWaterHeight(p.xy);
        float s = getSediment(p.xy);
        float surfaceH = h + w + s;
        
        if (p.z < surfaceH) {
            res = true;
            t -= 0.5;
            p = ro + rd * t;
            t_out = t;
            break;
        }
        
        float heightDiff = p.z - surfaceH;
        float dt = max(1.0, heightDiff * 0.4);
        t += dt;
    }
    return res;
}

void main() {
    outColor = vec4(-1.0, -1.0, 0.0, 1.0);

    // 3D Raymarching
    // Use supplied mouse pixel coordinates so we can render to a 1x1 target.
    vec2 uv = (u_mouse - 0.5 * u_resolution) / u_resolution.y;
    
    // Camera setup
    vec3 ro = u_cameraPos;
    vec3 ta = u_cameraTarget;
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 0.0, 1.0)));
    vec3 vv = normalize(cross(uu, ww));
    
    // Apply roll
    float ca = cos(u_cameraRoll);
    float sa = sin(u_cameraRoll);
    vec3 nu = ca * uu + sa * vv;
    vec3 nv = -sa * uu + ca * vv;
    uu = nu; vv = nv;
    
    float f = 1.0 / tan(radians(u_fov) * 0.5);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + f * ww);
        
    // Intersect bounding box
    vec3 boxMin = vec3(0.0, 0.0, -100.0);
    vec3 boxMax = vec3(u_size.x, u_size.y, 300.0);
    
    vec2 tBox = boxIntersection(ro, rd, boxMin, boxMax);
    
    if (tBox.y > 0.0) {
        float t_out;
        bool hit = rayMarch(tBox, ro, rd, t_out);
        if (hit) {
            vec2 pos = (ro + rd * t_out).xy;
            outColor = vec4(pos, 0.0, 1.0);
        }
    }
}`;
