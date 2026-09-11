(() => {
  const canvas = document.getElementById('brandOrb3d');
  if (!canvas) return;
  const stage = canvas.closest('.orb-stage');

  // Final hero cleanup: keep the art area clean and uncluttered.
  document.querySelector('.orb-labels')?.remove();
  document.querySelector('.purpose-note')?.remove();
  const hero = document.querySelector('.hero');
  const heroArt = document.querySelector('.hero-art');
  if (hero) hero.style.overflow = 'visible';
  if (heroArt) heroArt.style.overflow = 'visible';

  try {
    const THREE = window.THREE;
    if (!THREE) throw new Error('Three.js failed to load');

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
    // Final framing: enough air around the complete orbit system so no top arc clips.
    camera.position.set(0, 0.12, 10.45);

    const root = new THREE.Group();
    scene.add(root);

    const key = new THREE.DirectionalLight(0xfff0cf, 5.6);
    key.position.set(-3.4, 5.9, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc6ffff, 3.15);
    fill.position.set(4.9, 3.2, 4.4);
    scene.add(fill);

    const warmRim = new THREE.PointLight(0xffd69b, 28, 17, 2);
    warmRim.position.set(3.6, 1.5, 1.2);
    scene.add(warmRim);

    const topGlow = new THREE.PointLight(0xffffff, 21, 13, 2);
    topGlow.position.set(-2.5, 4.6, 4.5);
    scene.add(topGlow);

    const tealGlow = new THREE.PointLight(0x59e0df, 14, 11, 2);
    tealGlow.position.set(-3.4, -.4, 3.0);
    scene.add(tealGlow);

    scene.add(new THREE.HemisphereLight(0xfffbef, 0x052f38, 1.65));

    // Deep glossy teal glass orb.
    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x08737a,
      metalness: 0.04,
      roughness: 0.09,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      transmission: 0.16,
      thickness: 1.42,
      ior: 1.43,
      envMapIntensity: 1.8
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.54, 128, 128), orbMat);
    sphere.position.y = 0.42;
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    root.add(sphere);

    // Inner depth gives the orb a jewel/glass quality instead of a flat printed sphere.
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.43, 96, 96),
      new THREE.MeshBasicMaterial({color:0x0c525a,transparent:true,opacity:.18,side:THREE.BackSide})
    );
    inner.position.copy(sphere.position);
    root.add(inner);

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0c978,
      metalness: .68,
      roughness: .12,
      clearcoat: .94,
      clearcoatRoughness: .06,
      emissive: 0x2a1700,
      emissiveIntensity: .035
    });
    const paleGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe7ac,
      metalness: .54,
      roughness: .10,
      clearcoat: 1,
      clearcoatRoughness: .045,
      emissive: 0x3b2200,
      emissiveIntensity: .045
    });
    const deepGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xc58b32,
      metalness: .80,
      roughness: .14,
      clearcoat: .72,
      clearcoatRoughness: .08
    });
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff7e7,
      metalness: .04,
      roughness: .075,
      clearcoat: 1,
      clearcoatRoughness: .025,
      transmission: .035
    });

    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(1.555, .021, 24, 180), paleGoldMat);
    rimMesh.position.y = sphere.position.y;
    rimMesh.rotation.x = Math.PI/2;
    root.add(rimMesh);

    // Thin jewelry-like orbit system, fully contained in the camera frame.
    const rings = [];
    [
      [2.08,.012,-.46,.10,-.18],
      [1.91,.010,.19,1.08,.34],
      [2.19,.010,.35,.27,.55]
    ].forEach((spec, idx) => {
      const [radius,tube,rx,ry,rz] = spec;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius,tube,16,240),
        idx === 1 ? paleGoldMat : goldMat
      );
      ring.position.y = sphere.position.y;
      ring.rotation.set(rx,ry,rz);
      ring.castShadow = true;
      root.add(ring);
      rings.push(ring);
    });

    // Pearls sit comfortably inside the frame; nothing rides the canvas edge.
    [
      [-1.55, 1.44, .48, .13],
      [ 0.12, 2.12, .18, .14],
      [ 1.66, 1.14, .18, .14],
      [-1.72,-.16, .29, .125],
      [ 1.73,-.42, .34, .135]
    ].forEach(([x,y,z,r]) => {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(r,56,56), pearlMat);
      pearl.position.set(x,y,z);
      pearl.castShadow = true;
      root.add(pearl);
    });

    // Luxury compass rose: layered tapered gold needles instead of one flat textbook star.
    const compass = new THREE.Group();
    compass.position.set(0,.42,1.555);

    function makeNeedle(angle, length, width, material, z, depth=.045) {
      const shape = new THREE.Shape();
      shape.moveTo(0, -width*.18);
      shape.lineTo(-width, length*.19);
      shape.lineTo(0, length);
      shape.lineTo(width, length*.19);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape,{
        depth,
        bevelEnabled:true,
        bevelThickness:.014,
        bevelSize:.014,
        bevelSegments:3,
        curveSegments:2
      });
      geo.center();
      const needle = new THREE.Mesh(geo, material);
      needle.rotation.z = angle;
      needle.position.z = z;
      needle.castShadow = true;
      compass.add(needle);
    }

    // Cardinal points are longer and brighter. Intercardinals are shorter and slightly richer gold.
    for (let i=0;i<8;i++) {
      const a = -Math.PI/2 + i*Math.PI/4;
      const cardinal = i%2===0;
      makeNeedle(a, cardinal ? .96 : .67, cardinal ? .12 : .10, cardinal ? paleGoldMat : goldMat, cardinal ? .035 : .015, cardinal ? .06 : .048);
    }

    // Inner fine needles give the jewel-like layered compass seen in the approved target.
    for (let i=0;i<8;i++) {
      const a = -Math.PI/2 + Math.PI/8 + i*Math.PI/4;
      makeNeedle(a, .48, .055, deepGoldMat, .055, .032);
    }

    const centerBezel = new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.10,64), deepGoldMat);
    centerBezel.rotation.x = Math.PI/2;
    centerBezel.position.z = .11;
    compass.add(centerBezel);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(.095,56,56), paleGoldMat);
    jewel.position.z = .18;
    compass.add(jewel);

    root.add(compass);

    // Refined cream-and-gold pedestal.
    const marbleMat = new THREE.MeshPhysicalMaterial({
      color:0xf9f4ea,
      roughness:.16,
      metalness:.015,
      clearcoat:.72,
      clearcoatRoughness:.12
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.03,2.13,.50,128),marbleMat);
    base.position.y = -1.55;
    base.scale.z = .62;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const baseLip = new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.08,.075,128),goldMat);
    baseLip.position.y = -1.285;
    baseLip.scale.z = .64;
    root.add(baseLip);

    const upperPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.61,.20,128),goldMat);
    upperPlinth.position.y = -1.16;
    upperPlinth.scale.z = .68;
    root.add(upperPlinth);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.16,1.31,.115,128),paleGoldMat);
    topCap.position.y = -1.02;
    topCap.scale.z = .70;
    root.add(topCap);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.55,96),
      new THREE.MeshBasicMaterial({color:0xe5bb7c,transparent:true,opacity:.07,depthWrite:false})
    );
    glow.rotation.x = -Math.PI/2;
    glow.position.y = -1.84;
    root.add(glow);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024; labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    ctx.clearRect(0,0,1024,128);
    ctx.fillStyle = '#95692e';
    ctx.font = '600 52px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BRANDEDALIGN',512,64);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.44,.30),
      new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false})
    );
    label.position.set(0,-1.55,1.33);
    root.add(label);

    root.rotation.x = -.01;
    root.rotation.y = -.035;
    root.position.y = -.03;
    root.scale.set(.91,.91,.91);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1,Math.round(rect.width));
      const h = Math.max(1,Math.round(rect.height));
      renderer.setSize(w,h,false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(canvas);

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();

    function render(now) {
      const t = (now-t0)*.001;
      if (!reduceMotion) {
        root.rotation.y = -.035 + Math.sin(t*.22)*.022;
        root.position.y = -.03 + Math.sin(t*.38)*.018;
        rings[0].rotation.z = -.18 + Math.sin(t*.16)*.013;
        rings[1].rotation.z = .34 + Math.sin(t*.14+1.2)*.011;
        rings[2].rotation.z = .55 + Math.sin(t*.13+2.0)*.010;
      }
      renderer.render(scene,camera);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  } catch (err) {
    console.error('BrandedAlign 3D orb failed to initialize:', err);
    stage?.classList.add('webgl-failed');
  }
})();