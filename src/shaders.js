// ── Central shader registry ──────────────────────────────────────────────────
// All GLSL lives here. Add new shaders as named exports and wire them up
// in the corresponding effect module (shield.js, grid.js, etc.)

// ── Shield (ForceShield) ─────────────────────────────────────────────────────
export const shieldVertex = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  void main() {
    vObjPos  = position;
    vNormal  = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const shieldFragment = `
  #define MAX_HITS 6

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uLife;
  uniform float uHexScale;
  uniform float uEdgeWidth;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uFlashSpeed;
  uniform float uFlashIntensity;
  uniform float uNoiseScale;
  uniform vec3  uNoiseEdgeColor;
  uniform float uNoiseEdgeWidth;
  uniform float uNoiseEdgeIntensity;
  uniform float uNoiseEdgeSmoothness;
  uniform float uHexOpacity;
  uniform float uShowHex;
  uniform float uFlowScale;
  uniform float uFlowSpeed;
  uniform float uFlowIntensity;
  uniform vec3  uHitPos[MAX_HITS];
  uniform float uHitTime[MAX_HITS];
  uniform float uHitRingSpeed;
  uniform float uHitRingWidth;
  uniform float uHitMaxRadius;
  uniform float uHitDuration;
  uniform float uHitIntensity;
  uniform float uHitImpactRadius;
  uniform float uFadeStart;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  vec3 mod289v3(vec3 x){ return x - floor(x*(1./289.))*289.; }
  vec4 mod289v4(vec4 x){ return x - floor(x*(1./289.))*289.; }
  vec4 permute(vec4 x){ return mod289v4(((x*34.)+1.)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1./6., 1./3.);
    const vec4 D = vec4(0., 0.5, 1., 2.);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1. - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute(permute(permute(
      i.z+vec4(0.,i1.z,i2.z,1.))
     +i.y+vec4(0.,i1.y,i2.y,1.))
     +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_ = 0.142857142857;
    vec3  ns = n_*D.wyz - D.xzx;
    vec4 j   = p - 49.*floor(p*ns.z*ns.z);
    vec4 x_  = floor(j*ns.z);
    vec4 y_  = floor(j - 7.*x_);
    vec4 x   = x_*ns.x + ns.yyyy;
    vec4 y   = y_*ns.x + ns.yyyy;
    vec4 h   = 1. - abs(x) - abs(y);
    vec4 b0  = vec4(x.xy, y.xy);
    vec4 b1  = vec4(x.zw, y.zw);
    vec4 s0  = floor(b0)*2.+1.;
    vec4 s1  = floor(b1)*2.+1.;
    vec4 sh  = -step(h, vec4(0.));
    vec4 a0  = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1  = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0  = vec3(a0.xy, h.x);
    vec3 p1  = vec3(a0.zw, h.y);
    vec3 p2  = vec3(a1.xy, h.z);
    vec3 p3  = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m = max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m = m*m;
    return 42.*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  vec3 lifeColor(float life){
    return mix(vec3(1.0, 0.08, 0.04), uColor, life);
  }

  float hexPattern(vec2 p){
    p *= uHexScale;
    const vec2 s = vec2(1., 1.7320508);
    vec4 hC = floor(vec4(p, p-vec2(0.5,1.))/s.xyxy) + 0.5;
    vec4 h  = vec4(p-hC.xy*s, p-(hC.zw+0.5)*s);
    vec2 cell = (dot(h.xy,h.xy) < dot(h.zw,h.zw)) ? h.xy : h.zw;
    cell = abs(cell);
    float d = max(dot(cell, s*0.5), cell.x);
    return smoothstep(0.5-uEdgeWidth, 0.5, d);
  }

  vec2 hexCellId(vec2 p){
    p *= uHexScale;
    const vec2 s = vec2(1., 1.7320508);
    vec4 hC = floor(vec4(p, p-vec2(0.5,1.))/s.xyxy) + 0.5;
    vec4 h  = vec4(p-hC.xy*s, p-(hC.zw+0.5)*s);
    return (dot(h.xy,h.xy) < dot(h.zw,h.zw)) ? hC.xy : hC.zw+0.5;
  }

  float cellFlash(vec2 cellId){
    float rnd   = fract(sin(dot(cellId, vec2(127.1,311.7)))*43758.5453);
    float phase = rnd * 6.2831;
    float speed = 0.5 + rnd * 1.5;
    return smoothstep(0.6, 1.0, sin(uTime*uFlashSpeed*speed+phase)) * uFlashIntensity;
  }

  void main(){
    if (uOpacity < 0.001) discard;
    float noise = snoise(vObjPos * uNoiseScale) * 0.5 + 0.5;
    float revealMask = smoothstep(uReveal - uNoiseEdgeWidth, uReveal, noise);
    if (revealMask < 0.001) discard;

    float innerFade  = mix(0.98, 0.15, uNoiseEdgeSmoothness);
    float edgeLow    = smoothstep(uReveal-uNoiseEdgeWidth, uReveal-uNoiseEdgeWidth*innerFade, noise);
    float edgeHigh   = smoothstep(uReveal-uNoiseEdgeWidth*0.15, uReveal, noise);
    float revealEdge = edgeLow * (1.0 - edgeHigh);

    float fresnel = pow(1.0 - dot(vNormal, vViewDir), uFresnelPower) * uFresnelStrength;

    float t   = uTime * uFlowSpeed;
    float fn1 = snoise(vObjPos*uFlowScale + vec3(t, t*0.6, t*0.4));
    float flowNoise;
    if (fresnel > 0.05) {
      float fn2 = snoise(vObjPos*uFlowScale*2.1 + vec3(-t*0.5, t*0.9, t*0.3));
      flowNoise = (fn1*0.6 + fn2*0.4)*0.5 + 0.5;
    } else {
      flowNoise = fn1*0.5 + 0.5;
    }

    vec3 absN = abs(normalize(vObjPos));
    float dominance = max(absN.x, max(absN.y, absN.z));
    float hexFade   = smoothstep(0.65, 0.85, dominance);

    vec2 faceUV;
    if (absN.x >= absN.y && absN.x >= absN.z) {
      faceUV = vObjPos.yz;
    } else if (absN.y >= absN.z) {
      faceUV = vObjPos.xz;
    } else {
      faceUV = vObjPos.xy;
    }

    float hex   = hexPattern(faceUV) * hexFade;
    vec2  cId   = hexCellId(faceUV);
    float flash = cellFlash(cId) * hexFade;

    vec3  normPos     = normalize(vObjPos);
    float ringContrib = 0.0;
    float hexHitBoost = 0.0;

    for (int i = 0; i < MAX_HITS; i++) {
      float ht      = uHitTime[i];
      if (ht < -900.0) continue;
      float elapsed = uTime - ht;
      if (elapsed < 0.0 || elapsed > uHitDuration) continue;

      float dist = acos(clamp(dot(normPos, normalize(uHitPos[i])), -1.0, 1.0));

      float ringR      = min(elapsed * uHitRingSpeed, uHitMaxRadius);
      float noiseD     = snoise(normPos*5.0 + vec3(elapsed*2.0)) * 0.05;
      float ring       = smoothstep(uHitRingWidth, 0.0, abs(dist + noiseD - ringR));
      float fade       = 1.0 - smoothstep(uHitDuration*0.5, uHitDuration, elapsed);
      float radialFade = 1.0 - smoothstep(uHitMaxRadius*0.75, uHitMaxRadius, ringR);
      ringContrib     += ring * fade * radialFade;

      float zone     = smoothstep(uHitImpactRadius, 0.0, dist);
      float zoneFade = 1.0 - smoothstep(0.0, uHitDuration*0.35, elapsed);
      hexHitBoost   += zone * zoneFade;
    }

    ringContrib = min(ringContrib, 2.0);
    hexHitBoost = min(hexHitBoost, 1.0);

    vec3  lColor = lifeColor(uLife);

    float effectiveHexOpacity = (uHexOpacity + hexHitBoost * uHitIntensity) * uShowHex;
    float intensity = hex * effectiveHexOpacity * (0.3 + fresnel*0.7) + fresnel*0.4 + flash * uShowHex;

    vec3 shieldColor = lColor * intensity * 2.0;
    shieldColor += lColor * (flowNoise * fresnel * uFlowIntensity);
    shieldColor += lColor * ringContrib * uHitIntensity;

    vec3 edgeColor = mix(uNoiseEdgeColor, lColor, 1.0 - uLife);
    vec3 edgeGlow  = edgeColor * revealEdge * uNoiseEdgeIntensity;

    float alpha = clamp(intensity*uOpacity*revealMask + revealEdge*uNoiseEdgeIntensity, 0.0, 1.0);

    float normY = vObjPos.y / 1.8;
    alpha *= smoothstep(-1.0, uFadeStart, normY);

    gl_FragColor = vec4(shieldColor + edgeGlow, alpha);
  }
`;

// ── Grid floor ───────────────────────────────────────────────────────────────
export const gridVertex = `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const gridFragment = `
  uniform float uCellSize;
  uniform float uSectionSize;
  uniform float uFadeDistance;
  uniform vec3  uCellColor;
  uniform vec3  uSectionColor;
  uniform vec3  uShieldColor;
  uniform vec3  uShieldWorldPos;
  uniform float uShieldGlowIntensity;
  uniform vec3  uPortalWorldPos;
  uniform float uReflIntensity;
  uniform float uShowX;
  uniform float uShowZ;
  uniform sampler2D uFbmNoise;
  uniform sampler2D uNormalMap;
  uniform float uTexScale;
  uniform float uTexDistort;
  uniform sampler2D uLavaAO;
  uniform sampler2D uLavaHeight;
  uniform sampler2D uLavaRough;
  uniform vec3  uEnvBoxMin;
  uniform vec3  uEnvBoxMax;
  uniform vec3  uEnvBoxCenter;
  uniform float uEnvIntensity;
  uniform float uFbmScale;
  // bound automatically by the renderer when gridMat.envMap is set (PMREM CubeUV)
  uniform sampler2D envMap;
  varying vec3 vWorldPos;

  // provides textureCubeUV() — the box-projected reflection below uses it
  #include <cube_uv_reflection_fragment>

  void main() {
    float dist = length(vWorldPos.xz);
    if (dist > uFadeDistance * 1.2) discard;
    float fade = 1.0 - smoothstep(uFadeDistance * 0.2, uFadeDistance, dist);
    if (fade < 0.005) discard;

    // ── Grid lines ──
    float cLineX = abs(fract((vWorldPos.x - 0.5) / uCellSize) - 0.5) * uCellSize;
    float cLineZ = abs(fract((vWorldPos.z - 0.5) / uCellSize) - 0.5) * uCellSize;
    float cGridX = uShowX * (1.0 - smoothstep(0.0, 0.03, cLineX));
    float cGridZ = uShowZ * (1.0 - smoothstep(0.0, 0.03, cLineZ));
    float cGrid = max(cGridX, cGridZ);

    float sLineX = abs(fract((vWorldPos.x - 0.5) / uSectionSize) - 0.5) * uSectionSize;
    float sLineZ = abs(fract((vWorldPos.z - 0.5) / uSectionSize) - 0.5) * uSectionSize;
    float sGridX = uShowX * (1.0 - smoothstep(0.0, 0.06, sLineX));
    float sGridZ = uShowZ * (1.0 - smoothstep(0.0, 0.06, sLineZ));
    float sGrid = max(sGridX, sGridZ);

    vec3 lineColor = mix(uCellColor, uSectionColor, sGrid);
    float lineAlpha = max(cGrid * 0.35, sGrid) * fade;

    // ── Floor reflections (env + FBM smoke spots), computed separately ──
    vec3 reflColor = vec3(0.0);
    float reflA = 0.0;
    float smokeVal = 0.0;
    if (uReflIntensity > 0.001) {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec3 reflDir = reflect(-viewDir, vec3(0.0, 1.0, 0.0));

      vec2 localUV = vWorldPos.xz * uTexScale + 0.5;

      float heightSample = texture2D(uLavaHeight, localUV * 4.0).r;
      vec2 heightUV = localUV + reflDir.xz * heightSample * 0.02;

      vec3 normalSample = texture2D(uNormalMap, heightUV).rgb * 2.0 - 1.0;

      #ifdef ENVMAP_TYPE_CUBE_UV
        vec3 d = normalize(reflDir);
        vec3 first = (uEnvBoxMin - vWorldPos) / d;
        vec3 second = (uEnvBoxMax - vWorldPos) / d;
        vec3 far = max(first, second);
        float maxD = min(min(far.x, far.y), far.z);
        vec3 hit = vWorldPos + d * maxD;
        vec3 sampleDir = normalize(hit - uEnvBoxCenter);
        float rough = clamp(0.06 + texture2D(uLavaRough, localUV * 4.0).r * 0.5, 0.05, 0.85);
        reflColor = textureCubeUV(envMap, sampleDir, rough).rgb * uEnvIntensity;
      #endif

      vec2 distortedUV = reflDir.xz * uTexScale * uFbmScale + normalSample.rg * uTexDistort;
      smokeVal = texture2D(uFbmNoise, distortedUV).r;
      vec3 smokeColor = mix(vec3(0.1, 0.15, 0.3), vec3(0.3, 0.5, 0.8), smokeVal);
      reflColor += smokeColor * (smokeVal * 0.35);

      float ao = texture2D(uLavaAO, localUV * 4.0).r;
      reflColor *= mix(0.55, 1.0, ao);

      float edgeFade = 1.0 - smoothstep(0.3, 0.5, length(localUV - 0.5));
      reflA = (0.25 + 0.4 * smokeVal) * uReflIntensity * fade * edgeFade;
    }

    // ── Texture mask ──
    vec2 gridPos = vWorldPos.xz;
    vec2 portalPos = uPortalWorldPos.xz;
    vec2 toPos = gridPos - portalPos;
    vec2 rot = vec2(-toPos.y, toPos.x);                      // 90° left
    vec2 shadowAxes = vec2(2.5, 8.0);
    float shadowDist = length(rot / shadowAxes);
    float shadow = 1.0 - smoothstep(0.0, 1.0, shadowDist);
    shadow *= fade;

    // ── GLTF ring shadow ──
    vec2 shadowOffset = vec2(-3.5, 3.0);
    vec2 toShadow = gridPos - (portalPos + shadowOffset);
    float c45 = 0.707, s45 = 0.707;
    vec2 rotShadow = vec2(toShadow.x * c45 - toShadow.y * s45, toShadow.x * s45 + toShadow.y * c45);
    vec2 ringAxes = vec2(4.0, 5.5);
    float ringShadowDist = length(rotShadow / ringAxes);
    float ringShadow = 1.0 - smoothstep(0.0, 1.0, ringShadowDist);
    ringShadow *= fade;

    // ── Shield glow ──
    vec2 shieldPos = uShieldWorldPos.xz;
    float glowDist = length(gridPos - shieldPos);
    float glow = exp(-glowDist * glowDist * 0.15) * uShieldGlowIntensity * 0.5;
    glow *= fade;
    vec3 glowColor = uShieldColor * glow;

    // ── Combine base: lines + reflection, then shadow darkens everything ──
    vec3 baseColor = mix(reflColor, lineColor, lineAlpha) + glowColor;
    float baseAlpha = max(reflA, lineAlpha);

    float totalShadow = max(shadow, ringShadow);
    vec3 finalColor = mix(baseColor, vec3(0.0, 0.0, 0.02), totalShadow * 0.85);
    float finalAlpha = baseAlpha;

    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;
