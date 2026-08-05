import * as THREE from "three";
import { shieldVertex, shieldFragment } from "./shaders.js";
import { PROJECTS } from "./projects.js";

const MAX_HITS = 6;

export function createShieldMaterial() {
  const hitPositions = Array.from({ length: MAX_HITS }, () => new THREE.Vector3(0, 1.8, 0));
  const hitTimes = new Array(MAX_HITS).fill(-999);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:                { value: 0 },
      uColor:               { value: new THREE.Color("#FF2525") },
      uLife:                { value: 1.0 },
      uHexScale:            { value: 4.6 },
      uEdgeWidth:           { value: 0.25 },
      uFresnelPower:        { value: 0.5 },
      uFresnelStrength:     { value: 1.6 },
      uOpacity:             { value: 0.92 },
      uReveal:              { value: 0 },
      uFlashSpeed:          { value: 0.6 },
      uFlashIntensity:      { value: 0.11 },
      uNoiseScale:          { value: 1.3 },
      uNoiseEdgeColor:      { value: new THREE.Color("#FF2A2A") },
      uNoiseEdgeWidth:      { value: 0.02 },
      uNoiseEdgeIntensity:  { value: 10.0 },
      uNoiseEdgeSmoothness: { value: 0.5 },
      uHexOpacity:          { value: 0.26 },
      uShowHex:             { value: 0 },
      uFlowScale:           { value: 9.2 },
      uFlowSpeed:           { value: 2.21 },
      uFlowIntensity:       { value: 2 },
      uHitPos:              { value: hitPositions },
      uHitTime:             { value: hitTimes },
      uHitRingSpeed:        { value: 4.4 },
      uHitRingWidth:        { value: 0.5 },
      uHitMaxRadius:        { value: 3.14 },
      uHitDuration:         { value: 1.6 },
      uHitIntensity:        { value: 4.1 },
      uHitImpactRadius:     { value: 0.8 },
      uFadeStart:           { value: -1.0 },
    },
    vertexShader: shieldVertex,
    fragmentShader: shieldFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
}
