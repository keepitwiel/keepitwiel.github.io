export const RENDER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_terrain;
uniform sampler2D u_water;
uniform sampler2D u_sediment;
uniform sampler2D u_velocity;
uniform vec2 u_size; // Simulation size
uniform vec2 u_resolution; // Canvas resolution
uniform int u_viewMode; // 0: Composite, 1: Height, 2: Water, 3: Sediment, 4: Velocity
uniform float u_viewSensitivity;

// Camera uniforms
uniform vec3 u_cameraPos;
uniform vec3 u_cameraTarget;
uniform float u_fov;
uniform float u_cameraRoll;

out vec4 outColor;

const vec3 lightOrange = vec3(1.0, 0.6, 0.2);
const vec3 darkBlue = vec3(0.0, 0.1, 0.4);

const int COMPOSITE_VIEW = 0;
const int HEIGHT_VIEW = 1;
const int WATER_VIEW = 2;
const int SEDIMENT_VIEW = 3;
const int VELOCITY_VIEW = 4;

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

vec2 getVelocity(vec2 p) {
    if (p.x < 0.0 || p.x > u_size.x || p.y < 0.0 || p.y > u_size.y) return vec2(0.0);
    return texelFetch(u_velocity, ivec2(p), 0).xy;
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

vec3 getNormal(vec2 p) {
    float h = getTerrainHeight(p);
    float hL = getTerrainHeight(p + vec2(-1, 0));
    float hR = getTerrainHeight(p + vec2(1, 0));
    float hT = getTerrainHeight(p + vec2(0, -1));
    float hB = getTerrainHeight(p + vec2(0, 1));
    return normalize(vec3(hL - hR, hT - hB, 2.0));
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
            break;
        }
        
        float heightDiff = p.z - surfaceH;
        float dt = max(1.0, heightDiff * 0.4);
        t += dt;
    }
    t_out = t;
    return res;
}

void main() {
    // 3D Raymarching
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    
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
    
    vec3 col = vec3(0.5, 0.7, 0.9); // Sky
    
    // Intersect bounding box
    vec3 boxMin = vec3(0.0, 0.0, -100.0);
    vec3 boxMax = vec3(u_size.x, u_size.y, 300.0);
    
    vec2 tBox = boxIntersection(ro, rd, boxMin, boxMax);
    
    if (tBox.y > 0.0) {
        float t;
        bool hit = rayMarch(tBox, ro, rd, t);
        
        if (hit) {
            // Shading
            vec3 p = ro + rd * t;
            float h = getTerrainHeight(p.xy);
            float w = getWaterHeight(p.xy);
            float s = getSediment(p.xy);
            vec2 v = getVelocity(p.xy);
            float fl = w + s; // fluid height
            
            if (u_viewMode == COMPOSITE_VIEW) {
                vec3 n = getNormal(p.xy);
                vec3 lightDir = normalize(vec3(-1.0, -1.0, 1.0));
                float diff = max(0.0, dot(n, lightDir));
                float ambient = 0.2;

                // Terrain color
                float hNorm = h / 100.0;
                vec3 terrainColor;
                if (hNorm < 0.3) terrainColor = vec3(0.2, 0.6, 0.2);
                else if (hNorm < 0.7) terrainColor = vec3(0.4, 0.4, 0.3);
                else terrainColor = vec3(0.8, 0.8, 0.8);
                
                col = terrainColor * (ambient + diff);
                
                // fluid
                if (fl >= 0.0) {
                    float fr = s / fl;
                    float depth = min(1.0, fl * 0.5);
                    vec3 waterColor = mix(vec3(0.2, 0.4, 0.8), vec3(0.4, 0.3, 0.1), fr);
                    
                    vec3 wn = vec3(0.0, 0.0, 1.0);
                    float wDiff = max(0.0, dot(wn, lightDir));
                    float wSpec = pow(max(0.0, dot(reflect(-lightDir, wn), -rd)), 50.0);
                    
                    float alpha = min(0.9, 0.3 + depth * 0.6);
                    col = mix(col, waterColor * (ambient + wDiff) + vec3(wSpec), alpha);
                }
                // Fog
                float fog = 1.0 - exp(-t * 0.0005);
                col = mix(col, vec3(0.5, 0.7, 0.9), fog);

            } else if (u_viewMode == HEIGHT_VIEW) {
                float val = h / 100.0;
            } else if (u_viewMode == WATER_VIEW) {
                if (w < u_viewSensitivity) {
                    col = mix(vec3(0.0), lightOrange, w / u_viewSensitivity);
                } else {
                    float t = 1.0 - exp(-(w - u_viewSensitivity) * u_viewSensitivity);
                    col = mix(lightOrange, darkBlue, t);
                }
            } else if (u_viewMode == SEDIMENT_VIEW) {
                float val = s * u_viewSensitivity * 100.0;
                col = vec3(val, val * 0.5, 0.0);
            } else if (u_viewMode == VELOCITY_VIEW) {
                vec2 vn = v * u_viewSensitivity;
                col = vec3(length(vn), 0.5 + vn.x, 0.5 + vn.y);
            }
        }
    }
    
    outColor = vec4(col, 1.0);
}`;
