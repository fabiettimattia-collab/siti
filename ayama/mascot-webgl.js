import * as THREE from './vendor/three.module.js';

/* AYAMA explorer — original depth portrait, physical bronze optics and elastic rig. */
(() => {
  const stage = document.getElementById('mascot-stage');
  if (!stage) return;
  const hero = document.getElementById('home') || stage;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  const clamp = THREE.MathUtils.clamp;
  const damp = THREE.MathUtils.damp;
  const copy = {
    en: { idle: "Pull the leopard's goggles to explore Ayama", again: "Play with the leopard's goggles again", title: 'Pull, click or press Enter to explore', image: "Ayama's engraved leopard with explorer goggles", welcome: 'Welcome to our wild corner of the Cape.' },
    it: { idle: 'Abbassa gli occhiali del leopardo per esplorare Ayama', again: 'Gioca ancora con gli occhiali del leopardo', title: 'Trascina, clicca o premi Invio per esplorare', image: 'Il leopardo inciso di Ayama con occhiali da esploratore', welcome: 'Benvenuto nel nostro angolo selvaggio del Capo.' }
  };
  let language = document.documentElement.lang.startsWith('it') ? 'it' : 'en';
  let ready = false, destroyed = false, active = false, opening = false, revealed = false, pending = null, engine = null;
  stage.dataset.engine = 'loading';
  stage.dataset.state = 'loading';
  // The portrait ships without its free whiskers (they float in 3D), so the poster stacks both layers.
  stage.innerHTML = `<img class="webgl-poster" src="assets/leopard-v5.webp" width="1024" height="1536" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none"><img class="webgl-poster" src="assets/leopard-v5-whiskers.webp" width="1024" height="1536" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none"><canvas class="mascot-webgl-canvas" aria-hidden="true" style="display:block;position:absolute;inset:0;width:100%;height:100%;opacity:0"></canvas><button class="webgl-action" type="button" style="position:absolute;z-index:4;left:30%;top:20%;width:40%;height:24%;border:0;background:transparent;touch-action:none;cursor:grab"></button><span class="webgl-welcome" aria-live="polite" style="pointer-events:none;opacity:0"></span>`;
  const canvas = stage.querySelector('canvas');
  const action = stage.querySelector('button');
  const posters = [...stage.querySelectorAll('.webgl-poster')], poster = posters[0];
  const showPoster = visible => posters.forEach(image => { image.style.opacity = visible ? '1' : '0'; });
  const welcome = stage.querySelector('.webgl-welcome');
  function localise(value = language) {
    language = String(value).toLowerCase().startsWith('it') ? 'it' : 'en';
    action.setAttribute('aria-label', active ? copy[language].again : copy[language].idle);
    action.title = copy[language].title;
    poster.alt = copy[language].image;
    welcome.textContent = revealed ? copy[language].welcome : '';
  }
  localise();
  window.addEventListener('ayama:language', event => localise(event.detail?.language || document.documentElement.lang), { signal });

  function emitOpening(silent=false) {
    if(opening||destroyed)return;
    opening=true;stage.classList.add('is-opening');
    window.dispatchEvent(new CustomEvent('ayama:opening',{detail:{duration:silent?0:1050,revealAfter:silent?0:1450,silent}}));
  }
  function emitReveal() {
    if (revealed || destroyed) return;
    emitOpening(true);
    active = revealed = true;
    stage.classList.add('is-discovered');
    stage.dataset.state = 'discovered';
    welcome.style.opacity = '1';
    localise();
    window.dispatchEvent(new CustomEvent('ayama:discover'));
  }
  function fallback(error) {
    if (destroyed) return;
    engine?.destroy(); engine = null;
    stage.dataset.engine = 'fallback';
    stage.dataset.ready = 'true';
    stage.dataset.state = 'discovered';
    canvas.style.display = 'none';
    showPoster(true);
    action.style.display = 'none';
    hero.classList.remove('is-loading');
    console.warn('AYAMA mascot: static accessible fallback.', error?.message || error);
    queueMicrotask(emitReveal);
  }

  const api = {
    discover() { if (engine) engine.discover(); else pending = 'discover'; },
    skip() { if (engine) engine.skip(); else pending = 'skip'; },
    replay() {
      active = opening = revealed = false; welcome.style.opacity = '0'; localise();
      stage.classList.remove('is-opening', 'is-discovered', 'is-impact');
      window.dispatchEvent(new CustomEvent('ayama:reset'));
      if (engine) engine.replay(); else queueMicrotask(emitReveal);
    },
    destroy() {
      destroyed = true; lifetime.abort(); engine?.destroy();
      if (window.ayamaMascot === api) delete window.ayamaMascot;
    }
  };
  window.ayamaMascot = api;
  action.addEventListener('click', event => { if (event.detail === 0) api.discover(); }, { signal });

  async function initialise() {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    let shaderFailure = null;
    renderer.debug.onShaderError = (gl, program) => { shaderFailure = new Error(gl.getProgramInfoLog(program) || 'Portrait shader could not compile'); };
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
    const actor = new THREE.Group();
    scene.add(actor);
    // The neck is the hinge. The torso stays planted while the face and its equipment react.
    const neckPivot = new THREE.Vector3(0, -.38, .2);
    const headRig = new THREE.Group(); headRig.position.copy(neckPivot); actor.add(headRig);
    const headContents = new THREE.Group(); headContents.position.copy(neckPivot).negate(); headRig.add(headContents);
    const headMatrix = new THREE.Matrix4();
    const headNormalMatrix = new THREE.Matrix3();
    const resources = [];
    const keep = object => { resources.push(object); return object; };
    const loader = new THREE.TextureLoader();
    const colour = texture => { texture.colorSpace = THREE.SRGBColorSpace; return keep(texture); };
    const optional = async path => { try { return colour(await loader.loadAsync(path)); } catch { return null; } };
    // v5: one drawing from ears to paws, its free whiskers on their own layer,
    // a sculpted relief with head and ear weights, and eye plates for blinks and half lids.
    const [portrait, whiskerMap, rig, blinkPlate, smugPlate] = await Promise.all([
      loader.loadAsync('assets/leopard-v5.webp').then(texture => { texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8); return colour(texture); }),
      loader.loadAsync('assets/leopard-v5-whiskers.webp').then(colour),
      fetch('assets/leopard-v5-rig.bin').then(response => { if (!response.ok) throw new Error('Mascot rig unavailable'); return response.arrayBuffer(); }),
      optional('assets/leopard-v5-blink.webp'), optional('assets/leopard-v5-smug.webp')
    ]);
    if (destroyed) { renderer.dispose(); resources.forEach(r => r.dispose?.()); return; }

    // The rig holds one sample per vertex of a 160 x 240 plane, rows from the top:
    // relief (uint16, 0..2 units), then head, left-ear and right-ear weights (uint8).
    const columns = 161, rows = 241, samples = columns * rows;
    if (rig.byteLength !== samples * 5) throw new Error('Mascot rig has an unexpected size');
    const relief = new Uint16Array(rig, 0, samples), rigWeights = new Uint8Array(rig, samples * 2);
    const reliefAt = (x, y) => {
      const gx = clamp(x / 1023 * (columns - 1), 0, columns - 1.001), gy = clamp(y / 1535 * (rows - 1), 0, rows - 1.001);
      const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, at = (a, b) => relief[b * columns + a] / 32767.5;
      return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
    };
    const furGeometry = keep(new THREE.PlaneGeometry(5.12, 7.68, columns - 1, rows - 1));
    const headWeight = new Float32Array(samples), earWeight = new Float32Array(samples * 2);
    for (let i = 0; i < samples; i++) {
      furGeometry.attributes.position.setZ(i, relief[i] / 32767.5);
      headWeight[i] = rigWeights[i] / 255; earWeight[i * 2] = rigWeights[samples + i] / 255; earWeight[i * 2 + 1] = rigWeights[samples * 2 + i] / 255;
    }
    furGeometry.setAttribute('aHead', new THREE.BufferAttribute(headWeight, 1));
    furGeometry.setAttribute('aEar', new THREE.BufferAttribute(earWeight, 2));
    furGeometry.computeVertexNormals();
    const earLeft = new THREE.Matrix4(), earRight = new THREE.Matrix4();
    const uniforms = {
      uBlinkMap: { value: blinkPlate || portrait }, uSmugMap: { value: smugPlate || portrait }, uPlates: { value: new THREE.Vector2(blinkPlate ? 1 : 0, smugPlate ? 1 : 0) },
      uExpression: { value: 0 }, uSmirk: { value: 0 }, uSmug: { value: 0 }, uBlink: { value: new THREE.Vector2() }, uBrow: { value: new THREE.Vector2() },
      uSquint: { value: 0 }, uGaze: { value: new THREE.Vector4() }, uPupil: { value: 0 }, uSniff: { value: 0 }, uBreath: { value: 0 }, uBreathLift: { value: 0 }, uRelief: { value: .62 },
      uHeadMatrix: { value: headMatrix }, uHeadNormalMatrix: { value: headNormalMatrix }, uEarL: { value: earLeft }, uEarR: { value: earRight },
      uLens: { value: new THREE.Vector4(0, 0, 10, .1) }
    };
    // The relief is as deep as a real skull, so it must not magnify the drawing: each vertex is
    // pulled towards the camera axis by its depth and the rest pose projects exactly like the
    // engraving would at depth .6 (uLens: camera x, y, z in the body frame, 1 / (z - .6)).
    // Turning the head still rolls the face across the full depth.
    const lensVertex = `transformed.xy = uLens.xy + (transformed.xy - uLens.xy) * (uLens.z - transformed.z) * uLens.w;`;
    const furMaterial = keep(new THREE.MeshStandardMaterial({ map: portrait, transparent: true, alphaTest: .04, roughness: .93, metalness: 0, side: THREE.FrontSide, color: 0xffffff }));
    furMaterial.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `attribute float aHead; attribute vec2 aEar; uniform mat4 uHeadMatrix; uniform mat3 uHeadNormalMatrix; uniform mat4 uEarL; uniform mat4 uEarR; uniform float uBreath; uniform float uBreathLift; uniform float uRelief; uniform vec4 uLens;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
        // The engraving already carries its shading: the sculpted normals only steer it gently.
        vec3 objectNormal = normalize(mix(vec3(0.,0.,1.),normal,uRelief));
        objectNormal = normalize(mix(objectNormal,mat3(uEarL)*objectNormal,aEar.x));
        objectNormal = normalize(mix(objectNormal,mat3(uEarR)*objectNormal,aEar.y));
        objectNormal = normalize(mix(objectNormal,uHeadNormalMatrix*objectNormal,aHead));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif
      `);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        ${lensVertex}
        // Breathing lifts the chest and shoulders (the head rig rises with them); the folded arms stay put.
        float chest = (1.-aHead)*smoothstep(-1.55,-.85,position.y);
        transformed.z += chest*(1.-smoothstep(-.45,.2,position.y))*uBreath;
        transformed.y += chest*uBreathLift;
        transformed = mix(transformed,(uEarL*vec4(transformed,1.)).xyz,aEar.x);
        transformed = mix(transformed,(uEarR*vec4(transformed,1.)).xyz,aEar.y);
        transformed = mix(transformed,(uHeadMatrix*vec4(transformed,1.)).xyz,aHead);
      `);
      shader.fragmentShader = `uniform sampler2D uBlinkMap; uniform sampler2D uSmugMap; uniform vec2 uPlates; uniform float uExpression; uniform float uSmirk; uniform float uSmug; uniform vec2 uBlink; uniform vec2 uBrow; uniform float uSquint; uniform vec4 uGaze; uniform float uPupil; uniform float uSniff;
        float area(vec2 p,vec2 centre,vec2 radius,float inner){return 1.-smoothstep(inner,1.,length((p-centre)/radius));}
        float bell(vec2 p,vec2 centre,vec2 radius){vec2 d=(p-centre)/radius;return exp(-dot(d,d)*1.4);}
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec2 faceUV = vec2(vMapUv.x, 1. - vMapUv.y);
        vec2 px = faceUV*vec2(1024.,1536.);
        float leftEye = area(faceUV,vec2(.3628,.2484),vec2(.103,.062),.62);
        float rightEye = area(faceUV,vec2(.6563,.2484),vec2(.103,.062),.62);
        float eyes = max(leftEye,rightEye);
        vec2 expressiveUV = vMapUv;
        expressiveUV.y -= (uBrow.x*area(faceUV,vec2(.3628,.217),vec2(.105,.045),.25)+uBrow.y*area(faceUV,vec2(.6563,.217),vec2(.105,.045),.25))*.0045;
        expressiveUV.y += (vMapUv.y-.7516)*uSquint*eyes;
        // Deform a single engraving for the smile: independent generated fur
        // patterns must never crossfade through whiskers or the mouth contour.
        vec2 smileArea=(faceUV-vec2(.502,.4337))/vec2(.22,.075);
        float smileWeight=exp(-dot(smileArea,smileArea)*1.6);
        float smileCorners=smoothstep(.025,.15,abs(faceUV.x-.502));
        expressiveUV.y-=uExpression*.011*smileWeight*smileCorners;
        // The smirk: one mouth corner, its whisker pad and cheek rise; the chin purses.
        float corner = bell(px,vec2(440.,670.),vec2(66.,42.));
        float smirkLift = 23.*corner+13.*bell(px,vec2(418.,624.),vec2(96.,60.))+7.*bell(px,vec2(372.,452.),vec2(90.,44.))+5.*bell(px,vec2(515.,762.),vec2(105.,52.))+2.5*bell(px,vec2(588.,668.),vec2(60.,38.));
        expressiveUV.y -= uSmirk*smirkLift/1536.;
        expressiveUV.x += uSmirk*7.*corner/1024.;
        // A sniff lifts the nose leather and flares the nostrils.
        float nose = bell(px,vec2(514.,566.),vec2(86.,58.));
        expressiveUV.y -= uSniff*5.*nose/1536.;
        expressiveUV.x -= uSniff*.035*(px.x-514.)*nose/1024.;
        // Each iris slides inside its own eye opening (the eyes converge on what is close);
        // lids and outlines stay where they are drawn.
        vec2 gazeUV = expressiveUV - (uGaze.xy*area(px,vec2(371.5,381.5),vec2(50.,31.),.12)+uGaze.zw*area(px,vec2(672.,381.4),vec2(50.,31.),.12))/vec2(1024.,1536.);
        // The pupils widen around their drawn centres when the goggles are in play and narrow with the smirk.
        vec2 pupilL = vec2(374.8/1024.,1.-371./1536.), pupilR = vec2(668./1024.,1.-372./1536.);
        gazeUV = mix(gazeUV,pupilL,uPupil*.3*(1.-smoothstep(0.,30.,length((gazeUV-pupilL)*vec2(1024.,1536.)))));
        gazeUV = mix(gazeUV,pupilR,uPupil*.3*(1.-smoothstep(0.,30.,length((gazeUV-pupilR)*vec2(1024.,1536.)))));
        vec4 baseColor = texture2D(map, gazeUV);
        float halfLids = max(area(faceUV,vec2(.3628,.2484),vec2(.112,.07),.6),area(faceUV,vec2(.6563,.2484),vec2(.112,.07),.6));
        baseColor.rgb = mix(baseColor.rgb,texture2D(uSmugMap,gazeUV).rgb,uPlates.y*uSmug*halfLids);
        // The blink plate is the same drawing with only the eyelids replaced.
        baseColor.rgb = mix(baseColor.rgb,texture2D(uBlinkMap,expressiveUV).rgb,uPlates.x*max(uBlink.x*leftEye,uBlink.y*rightEye));
        diffuseColor *= baseColor;
      `);
    };
    const fur = new THREE.Mesh(furGeometry, furMaterial);
    fur.receiveShadow = true;
    actor.add(fur);

    // Free whisker shafts float just in front of the cheeks and swing rigidly with the head.
    const whiskerSides = [];
    for (const [sign, left, right, rootX] of [[-1, 30, 380, 330], [1, 644, 1000, 700]]) {
      const top = 500, bottom = 890, root = new THREE.Vector3(rootX * .005 - 2.56, 3.84 - 650 * .005, .5);
      // One material per side: the lens correction needs to know where the shafts sit on the face.
      const whiskerMaterial = keep(new THREE.MeshStandardMaterial({ map: whiskerMap, color: 0xe6dcc4, transparent: true, depthWrite: false, roughness: .85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      const rootUniform = { value: root };
      whiskerMaterial.onBeforeCompile = shader => {
        shader.uniforms.uLens = uniforms.uLens; shader.uniforms.uRoot = rootUniform;
        shader.vertexShader = 'uniform vec4 uLens; uniform vec3 uRoot;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
          vec3 transformed = uRoot + position;
          ${lensVertex}
          transformed -= uRoot;
        `);
      };
      const geometry = keep(new THREE.PlaneGeometry((right - left) * .005, (bottom - top) * .005, 40, 30));
      const position = geometry.attributes.position, uv = geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        const x = left + (position.getX(i) / .005 + (right - left) / 2), y = top + ((bottom - top) / 2 - position.getY(i) / .005);
        position.setXYZ(i, x * .005 - 2.56 - root.x, 3.84 - y * .005 - root.y, Math.max(reliefAt(x, y) + .035, .47 + .1 * clamp(Math.abs(x - rootX) / 300, 0, 1)) - root.z);
        uv.setXY(i, x / 1024, 1 - y / 1536);
      }
      geometry.computeVertexNormals();
      const pivot = new THREE.Group(); pivot.position.copy(root); headContents.add(pivot);
      const mesh = new THREE.Mesh(geometry, whiskerMaterial); mesh.renderOrder = 2; pivot.add(mesh);
      whiskerSides.push({ sign, pivot });
    }

    // A panoramic studio environment produces curved, moving reflections in real glass.
    const environmentCanvas = document.createElement('canvas');
    environmentCanvas.width = 1024; environmentCanvas.height = 512;
    const ec = environmentCanvas.getContext('2d');
    const gradient = ec.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#d6d5d2'); gradient.addColorStop(.38, '#7e7b78'); gradient.addColorStop(.55, '#2a282d'); gradient.addColorStop(1, '#0c0b0f');
    ec.fillStyle = gradient; ec.fillRect(0, 0, 1024, 512);
    ec.fillStyle = '#fffaf0'; ec.fillRect(80, 60, 225, 105);
    ec.fillStyle = '#dedad4'; ec.fillRect(700, 105, 250, 48);
    ec.fillStyle = '#a9a8ab'; ec.fillRect(360, 70, 18, 215);
    ec.fillStyle = '#ffffff'; ec.fillRect(440, 40, 120, 9);
    // The broad lower strip remains legible in the lenses once they reach the eyes.
    ec.fillStyle = '#f9f7f1'; ec.fillRect(745, 210, 180, 17);
    const environmentTexture = keep(new THREE.CanvasTexture(environmentCanvas));
    environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
    environmentTexture.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = keep(pmrem.fromEquirectangular(environmentTexture));
    scene.environment = environment.texture;
    scene.environmentIntensity = .43;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff9ed, 0x19171c, .85));
    const key = new THREE.DirectionalLight(0xfff5e3, 2.85); key.position.set(-3.5, 5.5, 6.5);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.camera.near = .5; key.shadow.camera.far = 20; key.shadow.bias = -.0002; key.shadow.normalBias = .025; key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe7e8ec, .95); fill.position.set(4, 2, 4); scene.add(fill);
    const edge = new THREE.DirectionalLight(0xffedbc, 1.75); edge.position.set(1, 4, -3); scene.add(edge);

    const metalCanvas = document.createElement('canvas'); metalCanvas.width = 512; metalCanvas.height = 128;
    const mc = metalCanvas.getContext('2d'); mc.fillStyle = '#e7e7e7'; mc.fillRect(0,0,512,128);
    for(let i=0;i<125;i++){const shade=175+Math.floor(Math.random()*75);mc.strokeStyle=`rgb(${shade},${shade},${shade})`;mc.lineWidth=.35+Math.random()*.6;mc.beginPath();const y=Math.random()*128;mc.moveTo(0,y);mc.lineTo(512,y+Math.random()*2);mc.stroke();}
    const metalWear = keep(new THREE.CanvasTexture(metalCanvas)); metalWear.wrapS = THREE.RepeatWrapping;
    const bronze = keep(new THREE.MeshStandardMaterial({ color: 0x927b54, metalness: .96, roughness: .3, roughnessMap: metalWear, bumpMap: metalWear, bumpScale: .002, envMapIntensity: 1.45 }));
    const paleBronze = keep(new THREE.MeshStandardMaterial({ color: 0xd8c59b, metalness: .98, roughness: .19, roughnessMap: metalWear, envMapIntensity: 1.65 }));
    const darkMetal = keep(new THREE.MeshStandardMaterial({ color: 0x252228, metalness: .88, roughness: .36 }));
    const rubber = keep(new THREE.MeshStandardMaterial({ color: 0x141217, roughness: .84, metalness: .05 }));
    const leatherCanvas = document.createElement('canvas'); leatherCanvas.width = leatherCanvas.height = 128;
    const lc = leatherCanvas.getContext('2d'); const leatherPixels = lc.createImageData(128,128);
    for(let i=0;i<leatherPixels.data.length;i+=4){const n=80+Math.random()*90;leatherPixels.data[i]=leatherPixels.data[i+1]=leatherPixels.data[i+2]=n;leatherPixels.data[i+3]=255;}
    lc.putImageData(leatherPixels,0,0);
    const leatherTexture = keep(new THREE.CanvasTexture(leatherCanvas)); leatherTexture.wrapS = leatherTexture.wrapT = THREE.RepeatWrapping; leatherTexture.repeat.set(5,1);
    const leatherMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x252229, roughness: .87, metalness: .02, bumpMap: leatherTexture, bumpScale: .014, side: THREE.DoubleSide }));
    const stitchesMaterial = keep(new THREE.LineBasicMaterial({ color: 0xc9c0ac, transparent: true, opacity: .75 }));
    const glassBack = keep(new THREE.MeshStandardMaterial({ color: 0x09080c, metalness: .65, roughness: .1, envMapIntensity: 1.15 }));
    const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0x121116, roughness: .045, metalness: .08, transmission: 0, thickness: .1, ior: 1.65, transparent: false, opacity: 1, clearcoat: 1, clearcoatRoughness: .025, envMapIntensity: 2.4 }));
    const lensEffects={uLensSweep:{value:0},uLensGlow:{value:0}};
    glass.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,lensEffects);
      shader.vertexShader='varying vec3 vLensPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vLensPosition=position;');
      shader.fragmentShader='varying vec3 vLensPosition; uniform float uLensSweep; uniform float uLensGlow;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float sweepLine = vLensPosition.x*.6+vLensPosition.y-mix(-.9,.9,uLensSweep);
        float reflectedBand = exp(-pow(sweepLine/.052,2.));
        float aperture = 1.-smoothstep(.44,.482,length(vLensPosition.xy));
        totalEmissiveRadiance += vec3(1.,.965,.86)*reflectedBand*aperture*uLensGlow*3.2;
      `);
    };

    // Posed by hand every frame (poseGoggles): seated, they take the portrait's lens correction.
    const goggles = new THREE.Group(); goggles.matrixAutoUpdate = false; headContents.add(goggles);
    const hitTargets = [];
    function solid(geometry, material, parent, x=0, y=0, z=0) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    const housingProfile = [[.465,-.23],[.527,-.23],[.575,-.17],[.59,.055],[.567,.17],[.533,.214],[.488,.214],[.47,.178],[.49,.13],[.485,-.15],[.465,-.23]].map(([x,y])=>new THREE.Vector2(x,y));
    const housingGeometry = keep(new THREE.LatheGeometry(housingProfile, 80)); housingGeometry.rotateX(Math.PI/2);
    const ringGeometry = keep(new THREE.TorusGeometry(.536,.021,12,100));
    const outerRingGeometry = keep(new THREE.TorusGeometry(.579,.012,8,100));
    const innerRingGeometry = keep(new THREE.TorusGeometry(.486,.018,12,100));
    const gasketGeometry = keep(new THREE.TorusGeometry(.493,.025,12,80));
    const screwGeometry = keep(new THREE.CylinderGeometry(.029,.029,.02,14)); screwGeometry.rotateX(Math.PI/2);
    const slotGeometry = keep(new THREE.BoxGeometry(.035,.005,.007));
    const ridgeGeometry = keep(new THREE.CylinderGeometry(.0055,.0055,.127,5)); ridgeGeometry.rotateX(Math.PI/2);
    const glassProfile = [];
    for(let i=0;i<=30;i++){const r=i/30*.48;glassProfile.push(new THREE.Vector2(r,.302-.122*(r/.48)**2));}
    // Lathe meridians run from the rim toward the apex so their normals face the camera.
    const glassGeometry = keep(new THREE.LatheGeometry(glassProfile.reverse(),96)); glassGeometry.rotateX(Math.PI/2);
    const matrix = new THREE.Matrix4();
    for(const sign of [-1,1]){
      const lens = new THREE.Group(); lens.position.x = sign*.75; goggles.add(lens);
      const housing = solid(housingGeometry, bronze, lens); hitTargets.push(housing);
      solid(ringGeometry, paleBronze, lens,0,0,.206);
      solid(innerRingGeometry, darkMetal,lens,0,0,.22);
      solid(gasketGeometry,rubber,lens,0,0,-.215);
      for(const z of [-.135,-.073,-.01,.053]) solid(outerRingGeometry,z===-.073?darkMetal:bronze,lens,0,0,z);
      const ridges = new THREE.InstancedMesh(ridgeGeometry, paleBronze,64); ridges.castShadow=true; lens.add(ridges);
      for(let i=0;i<64;i++){const a=i/64*Math.PI*2;matrix.makeTranslation(Math.cos(a)*.586,Math.sin(a)*.586,-.055);ridges.setMatrixAt(i,matrix);}
      for(let i=0;i<8;i++){
        const a=i/8*Math.PI*2+.12, x=Math.cos(a)*.548, y=Math.sin(a)*.548;
        solid(screwGeometry,paleBronze,lens,x,y,.217);
        const slot=solid(slotGeometry,darkMetal,lens,x,y,.232);slot.rotation.z=a+.4;
      }
      const back=solid(glassGeometry,glassBack,lens,0,0,-.022);back.castShadow=false;
      const face=solid(glassGeometry,glass,lens);face.castShadow=false;face.renderOrder=3;hitTargets.push(face);
      const connector=solid(keep(new THREE.BoxGeometry(.17,.16,.17)),bronze,lens,sign*.61,0,-.12);connector.rotation.z=sign*-.12;
    }
    const bridgeCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.28,.03,.02),new THREE.Vector3(-.18,.17,.055),new THREE.Vector3(0,.205,.09),new THREE.Vector3(.18,.17,.055),new THREE.Vector3(.28,.03,.02)]);
    solid(keep(new THREE.TubeGeometry(bridgeCurve,40,.066,12,false)),bronze,goggles);
    const bridgeHighlight=new THREE.CatmullRomCurve3([new THREE.Vector3(-.27,.09,.082),new THREE.Vector3(0,.251,.12),new THREE.Vector3(.27,.09,.082)]);
    solid(keep(new THREE.TubeGeometry(bridgeHighlight,32,.013,8,false)),paleBronze,goggles);
    const saddle=solid(keep(new THREE.SphereGeometry(.115,24,12)),rubber,goggles,0,.02,-.06);saddle.scale.set(1.15,.65,.6);

    // A rectangular leather ribbon with thickness and separate stitches, deformed every frame.
    const ribbons=[];
    for(const sign of [-1,1]){
      const segments=40, positions=new Float32Array((segments+1)*4*3),indices=[],uvs=new Float32Array((segments+1)*4*2);
      for(let i=0;i<=segments;i++)for(let j=0;j<4;j++){uvs[(i*4+j)*2]=i/segments;uvs[(i*4+j)*2+1]=(j===0||j===3)?0:1;}
      for(let i=0;i<segments;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,c,b,b,c,d);}
      const geometry=keep(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
      const mesh=solid(geometry,leatherMaterial,headContents);mesh.frustumCulled=false;
      const stitchGeometry=keep(new THREE.BufferGeometry());const stitchPositions=new Float32Array(30*2*2*3);stitchGeometry.setAttribute('position',new THREE.BufferAttribute(stitchPositions,3).setUsage(THREE.DynamicDrawUsage));
      const stitches=new THREE.LineSegments(stitchGeometry,stitchesMaterial);stitches.frustumCulled=false;headContents.add(stitches);
      ribbons.push({sign,segments,geometry,positions,stitchGeometry,stitchPositions});
    }
    const up=new THREE.Vector3(0,1,0), tangent=new THREE.Vector3(), side=new THREE.Vector3(), normal=new THREE.Vector3();
    function updateStraps(now){
      for(const ribbon of ribbons){
        const sign=ribbon.sign;
        const start=new THREE.Vector3(sign*1.425,0,-.13).applyMatrix4(goggles.matrix);
        const end=new THREE.Vector3(sign*1.67,2.19,.21);
        const extension=Math.max(0,start.z-end.z);
        const age=(now-impactAt-100)/1000;
        const jolt=age>=0&&age<.8?Math.sin(age*36+sign*.15)*Math.exp(-age*8):0;
        const middle=start.clone().lerp(end,.48);middle.x+=sign*.10;middle.z-=.06+extension*.07-jolt*.045;middle.y-=.08+jolt*.065;
        const curve=new THREE.CatmullRomCurve3([start,middle,end]);
        const offsets=[[-1,-1],[1,-1],[1,1],[-1,1]];
        for(let i=0;i<=ribbon.segments;i++){
          const t=i/ribbon.segments,p=curve.getPoint(t);curve.getTangent(t,tangent);side.copy(up).addScaledVector(tangent,-up.dot(tangent)).normalize();normal.crossVectors(tangent,side).normalize();
          const width=.088*(1-clamp(extension*.075,0,.25));
          for(let j=0;j<4;j++){const k=(i*4+j)*3;ribbon.positions[k]=p.x+side.x*offsets[j][0]*width+normal.x*offsets[j][1]*.017;ribbon.positions[k+1]=p.y+side.y*offsets[j][0]*width+normal.y*offsets[j][1]*.017;ribbon.positions[k+2]=p.z+side.z*offsets[j][0]*width+normal.z*offsets[j][1]*.017;}
        }
        ribbon.geometry.attributes.position.needsUpdate=true;ribbon.geometry.computeVertexNormals();
        let k=0;
        for(const edge of [-1,1])for(let i=0;i<30;i++)for(const offset of [0,.016]){
          const t=i/30+offset,p=curve.getPoint(t);curve.getTangent(t,tangent);side.copy(up).addScaledVector(tangent,-up.dot(tangent)).normalize();normal.crossVectors(tangent,side).normalize();
          ribbon.stitchPositions[k++]=p.x+side.x*edge*.067+normal.x*.018;ribbon.stitchPositions[k++]=p.y+side.y*edge*.067+normal.y*.018;ribbon.stitchPositions[k++]=p.z+side.z*edge*.067+normal.z*.018;
        }
        ribbon.stitchGeometry.attributes.position.needsUpdate=true;
      }
    }

    const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
    const gc=glowCanvas.getContext('2d'),glow=gc.createRadialGradient(64,64,0,64,64,64);glow.addColorStop(0,'rgba(255,255,252,1)');glow.addColorStop(.08,'rgba(255,250,231,.95)');glow.addColorStop(.26,'rgba(240,232,212,.24)');glow.addColorStop(1,'rgba(230,220,205,0)');gc.fillStyle=glow;gc.fillRect(0,0,128,128);
    gc.fillStyle='rgba(255,255,248,.8)';gc.fillRect(4,63,120,2);gc.fillRect(63,16,2,96);
    const glowTexture=keep(new THREE.CanvasTexture(glowCanvas));
    const glints=[];
    for(const sign of [-1,1]){const mat=keep(new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));const sprite=new THREE.Sprite(mat);sprite.position.set(sign*.75-.14,.21,.345);sprite.scale.setScalar(.9);goggles.add(sprite);glints.push(sprite);}

    // Seated on the eyes (texture 371,381 and 672,381); resting on the forehead above them, tilted back.
    // Each pose sits just clear of the relief under the back rims of both housings.
    function settle(x,y,tilt){
      const c=Math.cos(tilt),s=Math.sin(tilt),back=-.24;let z=0;
      for(const sign of [-1,1])for(let i=0;i<40;i++)for(const r of [.3,.42,.5,.59]){
        const a=i/40*Math.PI*2,lx=sign*.75+Math.cos(a)*r,ly=Math.sin(a)*r;
        z=Math.max(z,reliefAt((x+lx+2.56)/.005,(3.84-(y+ly*c-back*s))/.005)-(ly*s+back*c)+.05);
      }
      return new THREE.Vector3(x,y,z);
    }
    const rest=settle(.049,2.75,-.55),seated=settle(.049,1.933,0);
    const position=rest.clone(),velocity=new THREE.Vector3(),target=rest.clone();
    // The fur is drawn flat: the lens correction slides every vertex along the camera ray through
    // its drawn place. Real goggles in front of it would drift off the drawn eyes and show their
    // sides whenever the camera sits off axis (the open bust is framed to one side) or the body
    // turns. Seated, they take the same correction about their centre (to first order: drawn to
    // the camera axis by their depth, the depth itself sheared along the ray), so they sit squarely
    // on the eyes from wherever the camera looks. On the brow and in the hand they stay as they are.
    const lensFit=new THREE.Matrix4();
    function poseGoggles(fit){
      goggles.matrix.compose(goggles.position,goggles.quaternion,goggles.scale);
      if(fit>0){
        const L=uniforms.uLens.value,p=goggles.position,k=(L.z-p.z)*L.w,scale=1+(k-1)*fit,shearX=(L.x-p.x)*L.w*fit,shearY=(L.y-p.y)*L.w*fit;
        lensFit.set(scale,0,shearX,L.x*(1-k)*fit-shearX*p.z, 0,scale,shearY,L.y*(1-k)*fit-shearY*p.z, 0,0,1,0, 0,0,0,1);
        goggles.matrix.premultiply(lensFit);
      }
      goggles.matrixWorldNeedsUpdate=true;
    }
    const levelPoints=[new THREE.Vector3(),new THREE.Vector3()];
    const flightDirection=new THREE.Vector3(0,0,-1);
    const autoPullDirection=new THREE.Vector3(0,0,1);
    let width=1,height=1,frame=0,raf=0,last=performance.now(),visible=true,phase='idle',drag=null,touchStart=null;
    let autoStart=0,flightStart=0,impactAt=-10000,zoomStart=0,revealAt=0,blinkStart=0,nextBlink=performance.now()+1800;
    let mouseX=0,mouseY=0,yaw=0,pitch=0,roll=0,rigPitch=-.55,rigPitchVelocity=0,goggleRoll=0,expression=0,moodTarget=0,moodRate=9;
    let browLift=0,squint=0,bodyYaw=0,blinkCount=0,blinkDuration=230,blinkSide=0;
    const expressionEpoch=performance.now();
    // Character life: eyes that hold the visitor's gaze and follow the goggles once a hand is on
    // them, a lopsided smirk with half lids, ears that swivel, trail and flick, sniffs and whisker
    // twitches, all quiet under reduced motion.
    let smirk=0,smirkUntil=0,smug=0,perk=0,hovering=false,lastPointer=performance.now(),nextGlance=performance.now()+5000,glanceUntil=0,nextMicro=0,pupil=0,sniffStart=-10000,nextSniff=performance.now()+5200,nextEarFlick=performance.now()+2600,whiskerLift=0;
    let lastYaw=0,earLag=0,earLagVelocity=0,watching=false,gazeBlinkAt=-10000,hoverSince=0,tiltSide=1,tilt=0,pageDepth=0,pageLook=0,scrollKick=0,lastScrollY=window.scrollY,sideLayout=false;
    const glance=new THREE.Vector3(),micro=new THREE.Vector2(),brows=new THREE.Vector2(),gazeShift=new THREE.Vector4(),gazeGoal=new THREE.Vector4();
    // Each eyeball turns about a centre a quarter unit behind its iris (texture 371.5,381.5 and 672,381.4).
    const eyeCentres=[[371.5,381.5],[672,381.4]].map(([x,y])=>new THREE.Vector3(x*.005-2.56,3.84-y*.005,reliefAt(x,y)-.25));
    const eyeTarget=new THREE.Vector3(),eyeLook=new THREE.Vector3(),eyeLooks=[new THREE.Vector3(),new THREE.Vector3()],eyeRest=new THREE.Vector3(),headInverse=new THREE.Matrix4();
    const ears=[{start:-10000,duration:280,amount:0},{start:-10000,duration:280,amount:0}];
    // Ears hinge at their base and swivel about their own length (base 262,214 -> tip 180,60, mirrored).
    const earPivots=[new THREE.Vector3(-1.25,2.77,reliefAt(262,214)),new THREE.Vector3(1.29,2.77,reliefAt(770,214))],earMatrices=[earLeft,earRight],earTurn=new THREE.Matrix4(),earStep=new THREE.Matrix4();
    const earAxes=[new THREE.Vector3(-82,154,0).normalize(),new THREE.Vector3(80,154,0).normalize()];
    const flickEar=(now,index,amount=.13+Math.random()*.07)=>{const ear=ears[index];ear.start=now;ear.duration=230+Math.random()*120;ear.amount=amount;};
    let headKick=0,headKickVelocity=0,headNod=0,headNodVelocity=0,squash=0,squashVelocity=0,power=0,gestureDistance=0,wheelSum=0,lastDragEvent=0;
    let lastInput=performance.now(),inviteDone=false;
    let quality=1,frameAverage=16.7,slowFrames=0,skipFrame=false;
    const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),dragPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-1),dragPoint=new THREE.Vector3();
    const controlBox=new THREE.Box3(),projected=new THREE.Vector3(),lookAt=new THREE.Vector3(),lens=new THREE.Vector3();
    let introFrame,openFrame;
    const cameraForward=new THREE.Vector3();
    function composition(anchor,screenX,screenY,pixelsPerUnit,azimuth,elevation){
      const forward=new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
      const right=new THREE.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
      const up=forward.clone().cross(right).normalize();
      const center=anchor.clone().addScaledVector(right,-(screenX-width*.5)/pixelsPerUnit).addScaledVector(up,(screenY-height*.5)/pixelsPerUnit);
      return{center,distance:height/(2*Math.tan(THREE.MathUtils.degToRad(17))*pixelsPerUnit),azimuth,elevation};
    }
    function resize(){
      const rect=stage.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);camera.aspect=width/height;camera.updateProjectionMatrix();
      const viewportHeight=Math.min(height,window.innerHeight||height),portraitLayout=width<760||width/viewportHeight<.8;
      sideLayout=!portraitLayout;
      const closeScale=Math.min(width/4.6,viewportHeight/5.8);
      introFrame=composition(new THREE.Vector3(0,1.893,.74),width*.5,viewportHeight*(portraitLayout?.43:.54),closeScale,0,.02);
      if(portraitLayout){
        const scale=Math.min(width*.88/5.12,(height-100)/7.68);
        openFrame=composition(new THREE.Vector3(0,0,.45),width*.5,Math.min(805,height*.71),scale,.055,-.025);
      }else{
        // The complete bust (ears to paws) fills about 70% of the hero, clear of the top line.
        const scale=Math.min(height*.72/7.68,width*.43/5.12);
        openFrame=composition(new THREE.Vector3(0,0,.45),width*.72,height*.545,scale,.08,.02);
      }
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7)*quality);renderer.setSize(width,height,false);
    }
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
    window.addEventListener('resize',resize,{passive:true,signal});
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible&&!raf){last=performance.now();raf=requestAnimationFrame(render);}},{rootMargin:'100px'});intersection.observe(stage);
    function cursor(event){const rect=canvas.getBoundingClientRect();ndc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);return raycaster;}
    function scenePoint(event){cursor(event);return raycaster.ray.intersectPlane(dragPlane,dragPoint);}
    function eventPosition(){
      const point=goggles.getWorldPosition(projected).project(camera),rect=canvas.getBoundingClientRect(),bounds=hero.getBoundingClientRect();
      return {x:clamp((rect.left-bounds.left+(point.x+1)*.5*rect.width)/bounds.width,0,1),y:clamp((rect.top-bounds.top+(1-point.y)*.5*rect.height)/bounds.height,0,1)};
    }
    function dragEvent(isActive){const p=eventPosition();window.dispatchEvent(new CustomEvent('ayama:drag',{detail:{...p,power:clamp(power,0,1),active:isActive}}));}
    // The vineyard behind the portrait gathers round the face and rides the camera when it pulls
    // back, so it hears where the drawn eyes sit with the head at rest (a head turn does not move
    // the leaves) and how many pixels a scene unit spans there, both as fractions of the hero.
    const faceAnchor=new THREE.Vector3(),faceSide=new THREE.Vector3(),faceSent={x:0,y:0,unit:0};
    const faceX=(eyeCentres[0].x+eyeCentres[1].x)/2,faceY=(eyeCentres[0].y+eyeCentres[1].y)/2;
    function faceEvent(){
      actor.localToWorld(faceAnchor.set(faceX,faceY,.6)).project(camera);actor.localToWorld(faceSide.set(faceX+1,faceY,.6)).project(camera);
      const rect=canvas.getBoundingClientRect(),bounds=hero.getBoundingClientRect();
      const x=(rect.left-bounds.left+(faceAnchor.x+1)*.5*rect.width)/bounds.width,y=(rect.top-bounds.top+(1-faceAnchor.y)*.5*rect.height)/bounds.height;
      const unit=Math.hypot((faceSide.x-faceAnchor.x)*.5*rect.width,(faceSide.y-faceAnchor.y)*.5*rect.height)/bounds.height;
      if(Math.abs(x-faceSent.x)*bounds.width<1&&Math.abs(y-faceSent.y)*bounds.height<1&&Math.abs(unit-faceSent.unit)*bounds.height<.2)return;
      faceSent.x=x;faceSent.y=y;faceSent.unit=unit;
      window.dispatchEvent(new CustomEvent('ayama:frame',{detail:{x,y,unit}}));
    }
    function updateAction(){
      controlBox.makeEmpty();for(const hitTarget of hitTargets)controlBox.expandByObject(hitTarget);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const x of [controlBox.min.x,controlBox.max.x])for(const y of [controlBox.min.y,controlBox.max.y])for(const z of [controlBox.min.z,controlBox.max.z]){
        projected.set(x,y,z).project(camera);const sx=(projected.x+1)*.5*width,sy=(1-projected.y)*.5*height;minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);
      }
      action.style.left=`${minX-8}px`;action.style.top=`${minY-8}px`;action.style.width=`${maxX-minX+16}px`;action.style.height=`${maxY-minY+16}px`;
    }
    function land(now,silent=false){
      const first=!active;active=true;phase='impact';stage.dataset.state='impact';impactAt=silent?-10000:now;
      position.copy(seated);target.copy(seated);velocity.multiplyScalar(silent?0:-.08);rigPitch=0;rigPitchVelocity=0;moodTarget=1;moodRate=22;
      if(!silent){blinkStart=now;blinkDuration=310;blinkSide=0;nextBlink=now+2800;}
      if(first){zoomStart=silent?now-1100:now;revealAt=silent?now:now+1450;if(!silent)emitOpening(false);}
      goggles.position.copy(seated);goggles.rotation.x=0;poseGoggles(1);actor.updateMatrixWorld(true);
      if(!silent){headKickVelocity=-3.8;headNodVelocity=-2.25;squashVelocity=4.5;smirkUntil=now+2600;flickEar(now+60,0,.2);flickEar(now+120,1,.2);sniffStart=now+380;stage.classList.add('is-impact');const point=eventPosition();window.dispatchEvent(new CustomEvent('ayama:impact',{detail:{...point,power:clamp(Math.max(.5,power),0,1)}}));}
      localise();dragEvent(false);
      if(silent){phase='open';expression=1;uniforms.uExpression.value=1;queueMicrotask(emitReveal);}
    }
    function fly(now){
      phase='flight';stage.dataset.state='flying';flightStart=now;autoStart=0;target.copy(seated);moodTarget=0;moodRate=9;
      flightDirection.copy(seated).sub(position).normalize();velocity.multiplyScalar(.15).addScaledVector(flightDirection,3+5*clamp(power,0,1));
      rigPitchVelocity=active?0:2.2;dragEvent(false);
    }
    function discover(){
      if(media.matches){skip();return;}
      if(phase==='auto'||phase==='flight')return;
      drag=null;autoStart=performance.now();lastInput=autoStart;inviteDone=true;phase='auto';stage.dataset.state='pulling';gestureDistance=0;power=0;moodTarget=0;moodRate=9;
      actor.updateMatrixWorld(true);autoPullDirection.copy(camera.position);headContents.worldToLocal(autoPullDirection);autoPullDirection.sub(active?seated:rest).normalize();
    }
    function skip(){drag=null;autoStart=0;land(performance.now(),true);}
    function replay(){
      active=opening=revealed=false;phase='idle';stage.dataset.state='idle';autoStart=0;revealAt=0;zoomStart=0;position.copy(rest);target.copy(rest);velocity.set(0,0,0);power=0;expression=0;moodTarget=0;moodRate=9;rigPitch=-.55;rigPitchVelocity=0;goggleRoll=0;headKick=headNod=squash=headKickVelocity=headNodVelocity=squashVelocity=0;wheelSum=0;impactAt=-10000;lastInput=performance.now();inviteDone=false;nextBlink=lastInput+1600;localise();
      blinkStart=0;blinkSide=0;browLift=squint=0;uniforms.uBlink.value.set(0,0);uniforms.uBrow.value.set(0,0);uniforms.uSquint.value=0;
      smirk=smug=perk=whiskerLift=pupil=0;smirkUntil=glanceUntil=0;gazeShift.set(0,0,0,0);uniforms.uSmirk.value=uniforms.uSmug.value=uniforms.uSniff.value=uniforms.uPupil.value=0;uniforms.uGaze.value.set(0,0,0,0);
      if(media.matches)queueMicrotask(skip);
    }

    function pointerDown(event){
      if(event.button!==0||!ready||phase==='flight'||(phase==='impact'&&performance.now()-impactAt<100))return;
      const hits=cursor(event).intersectObjects(hitTargets,false);
      if(!hits.length&&event.target!==action){if(event.pointerType==='touch')touchStart={x:event.clientX,y:event.clientY};return;}
      event.preventDefault();stage.setPointerCapture(event.pointerId);
      actor.updateMatrixWorld(true);
      // From where the goggles physically are: the eye fit fades as they leave, without a jump.
      const baseWorld=headContents.localToWorld(position.clone());
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),baseWorld);
      const startWorld=scenePoint(event)?.clone()||baseWorld.clone();
      const pullWorld=camera.position.clone().sub(baseWorld).normalize();
      drag={id:event.pointerId,startWorld,pullWorld,baseWorld,targetWorld:baseWorld.clone(),screenX:event.clientX,screenY:event.clientY};gestureDistance=0;power=0;target.copy(position);autoStart=0;phase='drag';stage.dataset.state='dragging';action.style.cursor='grabbing';lastInput=performance.now();inviteDone=true;moodTarget=0;moodRate=9;
    }
    stage.addEventListener('pointerdown',pointerDown,{signal});
    stage.addEventListener('pointermove',event=>{
      if(touchStart&&!active&&!drag&&Math.abs(event.clientY-touchStart.y)>24){touchStart=null;discover();}
      if(!drag)return;
      event.preventDefault();const worldPoint=scenePoint(event);if(!worldPoint)return;
      gestureDistance=Math.max(gestureDistance,Math.hypot(event.clientX-drag.screenX,event.clientY-drag.screenY));
      const delta=worldPoint.clone().sub(drag.startWorld).multiplyScalar(.85),length=delta.length();
      const elasticity=length>0?1.5*(1-Math.exp(-length/1.5))/length:1;
      drag.targetWorld.copy(drag.baseWorld).addScaledVector(delta,elasticity).addScaledVector(drag.pullWorld,clamp(.10+length*1.15,0,2.55));
      power=clamp(drag.targetWorld.distanceTo(drag.baseWorld)/1.7,0,1.5);
    },{passive:false,signal});
    function pointerUp(event,cancelled=false){
      touchStart=null;if(!drag||drag.id!==event.pointerId)return;
      drag=null;if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);action.style.cursor='grab';
      if(!cancelled&&gestureDistance<6){discover();return;}
      if(!cancelled&&power>(active?.16:.32)){fly(performance.now());}
      else{phase=active?'open':'idle';stage.dataset.state=active?'discovered':'idle';target.copy(active?seated:rest);moodTarget=active?1:0;moodRate=7;lastInput=performance.now();inviteDone=false;dragEvent(false);}
    }
    stage.addEventListener('pointerup',event=>pointerUp(event),{signal});
    stage.addEventListener('pointercancel',event=>pointerUp(event,true),{signal});
    window.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch'||!visible)return;
      const rect=stage.getBoundingClientRect();mouseX=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);mouseY=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);lastPointer=performance.now();
    },{passive:true,signal});
    action.addEventListener('pointerenter',()=>{hovering=true;hoverSince=performance.now();tiltSide=-tiltSide;},{signal});
    action.addEventListener('pointerleave',()=>{hovering=false;},{signal});
    // Reading along: how far the page has scrolled past the hero, plus a kick from each scroll step.
    function readScroll(){
      const y=window.scrollY,bottom=hero.getBoundingClientRect().bottom;
      pageDepth=clamp(y/Math.max(1,(y+bottom)*.6),0,1);
      scrollKick=clamp(scrollKick+(y-lastScrollY)*.0025,-1,1);lastScrollY=y;
    }
    readScroll();window.addEventListener('scroll',readScroll,{passive:true,signal});
    hero.addEventListener('pointerleave',()=>{mouseX=mouseY=0;},{signal});
    hero.addEventListener('wheel',event=>{
      if(active||media.matches||event.deltaY<=0||event.ctrlKey)return;
      const rect=hero.getBoundingClientRect();if(rect.top< -rect.height*.25)return;
      wheelSum+=event.deltaY;if(wheelSum>24){event.preventDefault();discover();}
    },{passive:false,signal});
    window.addEventListener('keydown',event=>{
      if(active||!visible||![' ','Enter','ArrowDown','PageDown'].includes(event.key))return;
      if(event.target instanceof HTMLElement&&(event.target.isContentEditable||/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(event.target.tagName)))return;
      if(hero.getBoundingClientRect().top>=-80){event.preventDefault();discover();}
    },{signal});

    function integrate(dt,now){
      if(phase==='drag'&&drag){headContents.updateWorldMatrix(true,false);target.copy(drag.targetWorld);headContents.worldToLocal(target);}
      if(phase==='idle'&&!active&&!inviteDone){
        const t=(now-lastInput-2600)/1000;
        if(t>=0&&t<=.85){const invitation=Math.exp(-(((t-.16)/.10)**2))+.78*Math.exp(-(((t-.48)/.10)**2));target.copy(rest);target.z+=invitation*.13;target.y+=invitation*.018;}
        else if(t>.85){inviteDone=true;target.copy(rest);}
      }
      if(phase==='auto'){
        const t=clamp((now-autoStart)/800,0,1),ease=t<.5?4*t*t*t:1-((-2*t+2)**3)/2;
        target.lerpVectors(active?seated:rest,seated,ease).addScaledVector(autoPullDirection,1.85*ease);
        target.x+=.018*Math.sin(now*.047)*Math.max(0,(t-.7)/.3);
        power=clamp(ease,0,1);if(now-autoStart>=940)fly(now);
      }
      const frozen=phase==='impact'&&now-impactAt<100;
      if(!frozen){
        const stiffness=phase==='drag'||phase==='auto'?650:phase==='flight'?320:240;
        const damping=phase==='drag'||phase==='auto'?40:phase==='flight'?2:active?14:9;
        const step=dt/4;
        for(let i=0;i<4;i++){
          velocity.addScaledVector(target.clone().sub(position),stiffness*step);velocity.multiplyScalar(Math.exp(-damping*step));position.addScaledVector(velocity,step);
          const pullPitch=phase==='drag'||phase==='auto'?clamp(power/.55,0,1):phase==='flight'?1:0;
          const desiredPitch=active?0:-.55*(1-pullPitch);
          if(active){rigPitch=0;rigPitchVelocity=0;}else{rigPitchVelocity+=(desiredPitch-rigPitch)*240*step;rigPitchVelocity*=Math.exp(-18*step);rigPitch+=rigPitchVelocity*step;}
          headKickVelocity+=-headKick*270*step;headKickVelocity*=Math.exp(-14*step);headKick+=headKickVelocity*step;
          headNodVelocity+=-headNod*255*step;headNodVelocity*=Math.exp(-13*step);headNod+=headNodVelocity*step;
          squashVelocity+=-squash*480*step;squashVelocity*=Math.exp(-15*step);squash+=squashVelocity*step;
          if(phase==='flight'&&(position.clone().sub(seated).dot(flightDirection)>=0||position.distanceTo(seated)<.035)){land(now);break;}
        }
        if(phase==='impact'&&now-impactAt>=100)phase='open';
      }
      if(revealAt&&now>=revealAt){revealAt=0;emitReveal();}
      const motion=media.matches?0:1;
      const tension=phase==='drag'||phase==='auto'?clamp(power,0,1):0;
      const idlePhase=((now-expressionEpoch)/1000)%12;
      const curious=motion*(1-tension)*Math.max(clamp((Math.abs(mouseX)-.28)/.72,0,1)*.7,Math.exp(-(((idlePhase-3.8)/1.05)**2))*.72);
      const tempted=hovering&&!active&&phase==='idle'?1:0;
      // Lingering over the goggles without taking them: after a moment the head cocks to one
      // side (alternating from one visit to the next), puzzled.
      const lingering=hovering&&(phase==='idle'||phase==='open')?THREE.MathUtils.smoothstep(now-hoverSince,1400,2100)*motion:0;
      tilt=damp(tilt,lingering*tiltSide,lingering?2.6:5,dt);
      // Reading along: as the page scrolls past the hero the leopard looks down at it (and across,
      // when it sits beside the text) and dips with each scroll step; the pointer counts for less.
      pageLook=damp(pageLook,pageDepth*motion,3.5,dt);scrollKick=damp(scrollKick,0,3,dt);
      const pointerWeight=1-pageLook*.7,across=sideLayout&&active?-1:0;
      if(!frozen){
        yaw=damp(yaw,clamp(mouseX*.22*pointerWeight+pageLook*across*.14+(phase==='drag'?(position.x-rest.x)*.04:0),-.26,.26),5.8,dt);
        pitch=damp(pitch,mouseY*.09*pointerWeight+pageLook*.16+scrollKick*.05*motion-tension*.05-curious*.018-tempted*.035,5.4,dt);
        roll=damp(roll,Math.sin(now*.0007)*.009-yaw*.14+curious*.025+tilt*.13,4.6,dt);
        // The shoulders follow part of the head turn a beat later and lean into it, so the folded
        // arms show their own depth.
        bodyYaw=damp(bodyYaw,mouseX*.075,2.1,dt);
        actor.rotation.set(0,bodyYaw*motion,-bodyYaw*.12*motion);
        // Breathing lifts chest, shoulders and head together; the crossed paws remain anchored.
        actor.position.y=0;
        const breath=Math.sin(now*.00165)*motion;
        uniforms.uBreath.value=breath*.024;uniforms.uBreathLift.value=breath*.011;
        headRig.position.copy(neckPivot);headRig.position.y+=breath*.011;headRig.position.z+=(headKick+tension*.055)*motion;
        headRig.rotation.set((pitch+headNod)*motion,yaw*motion,roll*motion);
        headRig.scale.setScalar(1);
        headRig.updateMatrix();headContents.updateMatrix();
        headMatrix.multiplyMatrices(headRig.matrix,headContents.matrix);headNormalMatrix.getNormalMatrix(headMatrix);
      }
      if(!frozen)goggleRoll=damp(goggleRoll,clamp(-velocity.x*.035,-.2,.2),14,dt);
      const lensSquash=clamp(squash,-.18,.24)*motion;
      goggles.position.copy(position);goggles.rotation.set(rigPitch,(position.x-target.x)*.12,goggleRoll);goggles.scale.set(1+lensSquash,1-lensSquash,1);
      const age=(now-impactAt)/1000,flash=Math.max(0,1-age/.65);
      const sweep=clamp((age-.10)/.55,0,1),sweepGlow=age>=.10&&age<=.70?Math.sin(sweep*Math.PI):0;
      lensEffects.uLensSweep.value=sweep;lensEffects.uLensGlow.value=sweepGlow;
      glints.forEach((sprite,i)=>{const y=sweep*1.8-.9+.084;const aperture=1-THREE.MathUtils.smoothstep(Math.abs(y),.30,.44);sprite.position.set((i===0?-.75:.75)-.14,y,.345);sprite.material.opacity=sweepGlow*aperture*(i===0?.9:.65);sprite.scale.setScalar(.36+sweepGlow*.3);});
      glass.envMapIntensity=2.4+flash*3.2;glassBack.envMapIntensity=1.15+flash*1.1;
      key.intensity=2.85+flash*.65;fill.intensity=.95+flash*.55;
      if(age>1.2)stage.classList.remove('is-impact');
      // Every twelve seconds the idle leopard pulls the old lopsided smirk, half lids and a cocked brow.
      const quietSmirk=motion*Math.exp(-(((idlePhase-8.4)/1.3)**2));
      const pulling=phase==='drag'||phase==='auto'||phase==='flight';
      const expressionTarget=pulling?0:active?Math.max(.78,moodTarget-curious*.16):quietSmirk*.35;
      if(!frozen)expression=damp(expression,expressionTarget,active?moodRate:3.8,dt);
      uniforms.uExpression.value=expression;
      const smirkTarget=pulling?0:now<smirkUntil?1:active?.38:Math.max(quietSmirk,tempted*.55);
      smirk=damp(smirk,smirkTarget*motion,smirkTarget>smirk?9:3.2,dt);
      smug=damp(smug,(pulling?0:Math.max(smirk*.9,quietSmirk))*motion,6,dt);
      uniforms.uSmirk.value=smirk;uniforms.uSmug.value=smug;
      browLift=damp(browLift,curious+tempted*.6-tension*.55,5.5,dt);
      // The smirk cocks the brow opposite the raised mouth corner.
      brows.set(browLift-smirk*.35,browLift+smirk*.9);
      squint=damp(squint,tension*.32+smirk*.06,7,dt);
      uniforms.uBrow.value.copy(brows).multiplyScalar(motion);uniforms.uSquint.value=squint*motion;
      // Sniffs: two quick lifts of the nose leather with the whiskers twitching forward.
      if(now>=nextSniff&&!pulling){sniffStart=now;nextSniff=now+6500+Math.random()*5500;}
      const sniffT=(now-sniffStart)/1000,sniff=sniffT>=0&&sniffT<.44?Math.sin(sniffT/.22*Math.PI)**2*(sniffT<.22?1:.7):0;
      uniforms.uSniff.value=sniff*motion;
      whiskerLift=damp(whiskerLift,(sniff*.05+smirk*.035-tension*.04)*motion,18,dt);
      whiskerSides.forEach(({sign,pivot})=>{pivot.rotation.z=sign*(whiskerLift+(sign<0?smirk*.03:0)*motion)+Math.sin(now*.0021+sign)*.006*motion;});
      // Ears: they swivel towards the pointer while the eyes stay on the visitor, trail the head
      // when it turns, flick now and then, perk up when curious or tempted and fold back while
      // the goggles are pulled.
      if(now>=nextEarFlick&&!pulling){const both=Math.random()<.22;flickEar(now,Math.random()<.5?0:1);if(both)flickEar(now+90,ears[0].start===now?1:0);nextEarFlick=now+3200+Math.random()*4800;}
      perk=damp(perk,Math.max(curious,tempted,lingering),4,dt);
      const yawSpeed=dt>0?(yaw-lastYaw)/dt:0;lastYaw=yaw;
      earLagVelocity+=(-yawSpeed*.2-earLag)*120*dt;earLagVelocity*=Math.exp(-12*dt);earLag+=earLagVelocity*dt;
      ears.forEach((ear,i)=>{
        const t=(now-ear.start)/ear.duration,flick=t>=0&&t<1?Math.sin(Math.PI*t)*(1+.35*Math.sin(Math.PI*2*t)):0;
        const outward=(flick*ear.amount+tension*.07-perk*.03)*motion*(i===0?1:-1),fold=(-flick*.06-tension*.32+perk*.07)*motion;
        const swivel=clamp(mouseX*.3+earLag,-.5,.5)*motion;
        const pivot=earPivots[i];
        earTurn.makeRotationZ(outward).multiply(earStep.makeRotationAxis(earAxes[i],swivel)).multiply(earStep.makeRotationX(fold));
        earMatrices[i].makeTranslation(pivot.x,pivot.y,pivot.z).multiply(earTurn).multiply(earStep.makeTranslation(-pivot.x,-pivot.y,-pivot.z));
      });
      if(now>=nextBlink&&!media.matches&&phase!=='flight'&&phase!=='drag'){
        blinkStart=now;blinkCount++;blinkSide=blinkCount%4===0?(blinkCount%8===0?-1:1):0;
        blinkDuration=blinkSide?340:blinkCount%3===0?420:230;nextBlink=now+2900+Math.random()*2600;
      }
      const blinkT=(now-blinkStart)/blinkDuration;
      const close=blinkT>=0&&blinkT<1?(blinkT<.28?THREE.MathUtils.smoothstep(blinkT,0,.28):1-THREE.MathUtils.smoothstep(blinkT,.42,1)):0;
      uniforms.uBlink.value.set(blinkSide===1?0:close*motion,blinkSide===-1?0:close*motion);
      if(frame%8===0)stage.dataset.expression=close>.3?(blinkSide?'wink':'blink'):tension>.2?'focused':sniff>.3?'sniff':smirk>.5?'smirk':curious>.35?'curious':expression>.45?'smile':'attentive';
      const zoom=active?(media.matches?1:clamp((now-zoomStart)/1050,0,1)):0,eased=1-(1-zoom)**4;
      const distance=THREE.MathUtils.lerp(introFrame.distance,openFrame.distance,eased);
      const shake=age>=.1&&age<.7?Math.exp(-(age-.1)*7)*.075:0;
      const azimuth=THREE.MathUtils.lerp(introFrame.azimuth,openFrame.azimuth,eased)+Math.sin(now*.00037)*.004*motion;
      const elevation=THREE.MathUtils.lerp(introFrame.elevation,openFrame.elevation,eased);
      lookAt.copy(introFrame.center).lerp(openFrame.center,eased);
      cameraForward.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
      camera.position.copy(lookAt).addScaledVector(cameraForward,distance);camera.position.x+=Math.sin(now*.08)*shake;camera.position.y+=Math.cos(now*.067)*shake;camera.lookAt(lookAt);
      actor.updateMatrixWorld();lens.copy(camera.position);actor.worldToLocal(lens);
      uniforms.uLens.value.set(lens.x,lens.y,lens.z,1/(lens.z-.6));camera.updateMatrixWorld();
      const seat=1-THREE.MathUtils.smoothstep(position.distanceTo(seated),.05,.55),worn=active?seat*motion:0;
      poseGoggles(seat);
      // Worn, the goggles also stay level on screen. The head gives up the roll that would tilt
      // them (its lean into a turn, the idle sway, and the slant perspective gives a turned head
      // above the camera) and keeps only the puzzled cock.
      if(worn>0&&!frozen){
        for(let i=0;i<2;i++){
          const point=levelPoints[i].set(seated.x+(i?.75:-.75),seated.y,seated.z),k=(lens.z-point.z)/(lens.z-.6);
          point.x=lens.x+(point.x-lens.x)*k;point.y=lens.y+(point.y-lens.y)*k;
          actor.localToWorld(point.applyMatrix4(headMatrix)).applyMatrix4(camera.matrixWorldInverse);
        }
        const [left,right]=levelPoints,slant=Math.atan2(left.y/left.z-right.y/right.z,left.x/left.z-right.x/right.z);
        headRig.rotation.z-=(slant-tilt*.13)*worn;
        headRig.updateMatrix();headMatrix.multiplyMatrices(headRig.matrix,headContents.matrix);headNormalMatrix.getNormalMatrix(headMatrix);
      }
      if((active&&zoom<1)||frame%10===0)faceEvent();
      // Eyes hold the visitor's gaze (the camera) however the head turns. Once a hand is on the
      // goggles, or while they hop to invite one, the eyes follow the goggles instead, converging
      // as they come close. When the pointer rests the leopard glances away now and then, and
      // both eyes keep making tiny jumps.
      const inviting=phase==='idle'&&!active&&!inviteDone&&now-lastInput>=2600;
      const watchGoggles=pulling||tempted===1||inviting;
      if(watchGoggles!==watching){
        watching=watchGoggles;
        // The lids close briefly as the eyes jump between the visitor and the goggles (never over a
        // blink already under way, nor twice for a pointer flicking on and off).
        if(motion&&!(blinkT>=0&&blinkT<1)&&now-gazeBlinkAt>1000){gazeBlinkAt=blinkStart=now;blinkDuration=190;blinkSide=0;nextBlink=Math.max(nextBlink,now+2400);}
      }
      if(watchGoggles){goggles.getWorldPosition(eyeTarget);glanceUntil=0;}
      else{
        eyeTarget.copy(camera.position);
        // Reading along, the eyes drop to the page and towards the text beside the leopard.
        eyeTarget.y-=pageLook*7+scrollKick*2.5;eyeTarget.x+=pageLook*across*3;
        if(now-lastPointer>2200&&now>=nextGlance&&pageLook<.2){glance.set((Math.random()<.5?-1:1)*(1.2+Math.random()*1.8),(Math.random()*2-1)*.9,0);glanceUntil=now+450+Math.random()*500;nextGlance=now+4500+Math.random()*4500;}
        if(now<glanceUntil)eyeTarget.add(glance);
      }
      if(now>=nextMicro){micro.set((Math.random()*2-1)*.8,(Math.random()*2-1)*.5);nextMicro=now+500+Math.random()*900;}
      actor.worldToLocal(eyeTarget);eyeTarget.applyMatrix4(headInverse.copy(headMatrix).invert());
      eyeCentres.forEach((centre,i)=>eyeLooks[i].subVectors(eyeTarget,centre).normalize());
      eyeLook.addVectors(eyeLooks[0],eyeLooks[1]).normalize();
      eyeCentres.forEach((centre,i)=>{
        // The drawn irises look at the camera while leopard and body face it squarely; each one
        // moves on a 50 px eyeball, converging only halfway on near things so it never squints.
        eyeLooks[i].lerp(eyeLook,.5).normalize();eyeRest.subVectors(camera.position,centre).normalize();
        let x=(eyeLooks[i].x-eyeRest.x)*50+micro.x,y=(eyeLooks[i].y-eyeRest.y)*50+micro.y;
        const reach=Math.hypot(x/13,y/8);if(reach>1){x/=reach;y/=reach;}
        gazeGoal.setComponent(i*2,x*motion);gazeGoal.setComponent(i*2+1,y*motion);
      });
      gazeShift.lerp(gazeGoal,1-Math.exp(-28*dt));uniforms.uGaze.value.copy(gazeShift);
      // Pupils widen with excitement when the goggles are in play and narrow with the smirk.
      pupil=damp(pupil,(watchGoggles?.85:.12+.08*Math.sin(now*.0009))-smirk*.25,4,dt);
      uniforms.uPupil.value=pupil*motion;
      if((phase==='drag'||phase==='auto')&&now-lastDragEvent>32){dragEvent(true);lastDragEvent=now;}
    }
    function render(now){
      raf=0;if(destroyed||!visible||document.hidden)return;
      // A frame stamp can predate the moment the loop (re)started: a negative step would make
      // every damped value overshoot wildly, so time never runs backwards here.
      const elapsed=now-last,dt=clamp(elapsed/1000,0,.035);last=now;frame++;
      integrate(dt,now);updateStraps(now);
      renderer.render(scene,camera);
      if(shaderFailure){fallback(shaderFailure);return;}
      if(frame%2===0)updateAction();
      if(!ready){
        ready=true;stage.dataset.engine='webgl';stage.dataset.ready='true';stage.dataset.state='idle';canvas.style.opacity='1';showPoster(false);hero.classList.remove('is-loading');
        if(media.matches||pending==='skip'||hero.classList.contains('is-discovered'))skip();else if(pending==='discover')discover();pending=null;
      }
      if(frame>60&&elapsed<100){frameAverage=frameAverage*.97+elapsed*.03;if(frameAverage>28)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>100&&quality>.68){quality=Math.max(.68,quality-.16);slowFrames=0;resize();}}
      raf=requestAnimationFrame(render);
    }
    engine={discover,skip,replay,destroy(){cancelAnimationFrame(raf);resizeObserver.disconnect();intersection.disconnect();resources.forEach(resource=>resource.dispose?.());renderer.dispose();}};
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible&&!raf){last=performance.now();raf=requestAnimationFrame(render);}},{signal});
    media.addEventListener('change',()=>{if(media.matches)skip();},{signal});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);fallback(new Error('WebGL context unavailable'));},{signal});
    last=performance.now();raf=requestAnimationFrame(render);
  }
  initialise().catch(fallback);
})();
