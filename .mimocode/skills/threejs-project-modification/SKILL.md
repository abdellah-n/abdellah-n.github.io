---
name: threejs-project-modification
description: Modify Three.js/WebGL projects by exploring structure, reading source files, understanding the codebase, and implementing changes (HDRI environments, effects, loaders, etc.)
---

# Three.js Project Modification

A workflow for modifying Three.js/WebGL projects. Use this when the user wants to add, change, or remove features in a Three.js project (HDRI environments, particle effects, post-processing, loaders, etc.).

## When to Use

- User wants to modify a Three.js project (add effects, change environment, update loaders, etc.)
- User references an existing agent-skill or code snippet to integrate
- Project uses Vite + ES modules with Three.js

## Workflow Steps

### 1. Explore Project Structure

```bash
# List project root
ls -la <project-dir>

# Find all source files
glob **/*.{html,js,ts,json}
glob src/**/*
```

Identify:
- Entry point (index.html, main.js, app.js)
- Build config (vite.config.js, webpack.config.js, package.json)
- Source directories (src/, public/, assets/)
- Existing Three.js setup files

### 2. Read Existing Source Files

Read the core files to understand the current setup:
- `index.html` - HTML structure, canvas container
- `src/main.js` or `src/app.js` - Three.js initialization, scene, camera, renderer
- `src/scene.js` or similar - Scene objects, geometries, materials
- `src/config.js` - Configuration, API keys, constants
- `package.json` - Dependencies, Three.js version
- `vite.config.js` - Build configuration

### 3. Read Reference Materials

If the user references an agent-skill or code snippet:
- Read the skill's README.md for context
- Read the skill's source files (script.js, style.css)
- Understand what the skill does and how to integrate it

### 4. Understand the Codebase

Analyze:
- **Renderer setup**: WebGLRenderer config (antialias, alpha, toneMapping, outputColorSpace)
- **Camera**: PerspectiveCamera settings (fov, near, far, position)
- **Scene**: Background, fog, environment map
- **Loaders**: What loaders are used (TextureLoader, RGBELoader, GLTFLoader, etc.)
- **Effects**: Post-processing, particles, shaders
- **Animation**: RequestAnimationFrame loop, GSAP, ScrollTrigger

### 5. Implement Changes

Based on the user's request:

#### Adding HDRI Environment
```javascript
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const hdris = [
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/...'
  // Add more HDRI URLs
];

const loader = new RGBELoader();
loader.load(hdris[Math.floor(Math.random() * hdris.length)], (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});
```

#### Adding Blur Effect (Post-Processing)
```javascript
// Use EffectComposer with BlurPass
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { BlurPass } from 'three/addons/postprocessing/BlurPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new BlurPass(12)); // blur radius

// In animation loop:
composer.render();
```

#### Adding Smoke/Particle Effects
Reference the `agent-skills/webgl-smoke/` skill:
- Read `src/script.js` for the smoke particle system
- Read `src/style.css` for styling
- Integrate into the main scene

### 6. Verify Changes

```bash
# Build the project
npm run build

# Check for errors
npm run dev  # or npm start
```

## Common Patterns

### HDRI Loading (Compressed)
```javascript
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
// RGBELoader for .hdr format (compressed)
// Use texture.mapping = THREE.EquirectangularReflectionMapping
```

### Blur Shader (Fullscreen Quad)
```javascript
// Vertex shader: pass UV coordinates
// Fragment shader: Gaussian blur with direction uniform
// Ping-pong between two render targets for multi-pass blur
```

### Smoke Projection
```javascript
// Project smoke texture onto SphereGeometry
const geometry = new THREE.SphereGeometry(50, 64, 64);
const material = new THREE.MeshBasicMaterial({
  map: smokeTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide
});
```

## Rules

- **Title positioning**: Left-aligned (not centered) unless user specifies otherwise
- **Loaders**: Use RGBELoader for .hdr format, not TextureLoader
- **Renderer config**: ACESFilmicToneMapping, SRGBColorSpace, pixelRatio capped at 2
- **Import syntax**: Use ES modules (`import ... from ...`) with Vite

## Gotchas

- `THREE.ImageUtils.loadTexture` is deprecated — use `THREE.TextureLoader`
- scene.js may contain GLSL shaders — understand before modifying
- config.js may contain API keys — handle carefully
- Smoke textures hosted on external URLs may be unreliable — consider bundling locally

## Stopping Condition

- All requested changes are implemented
- Project builds without errors (`npm run build` succeeds)
- User confirms the changes work as expected
