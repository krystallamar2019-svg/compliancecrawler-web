(() => {
  const canvas = document.getElementById('brandOrb3d');
  if (!canvas) return;
  const stage = canvas.closest('.orb-stage');

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
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.25, 8.4);

    const root = new THREE.Group();
    scene.add(root);

    const key = new THREE.DirectionalLight(0xffe6bf, 4.2);
    key.position.set(-3.8, 5.8, 5.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xbfeff0, 2.3);
    fill.position.set(4.5, 2.5, 3.5);
    scene.add(fill);

    const rim = new THREE.PointLight(0xffd39a, 22, 16, 2);
    rim.position.set(3.2, 1.2, -1.5);
    scene.add(rim);

    const topGlow = new THREE.PointLight(0xffffff, 16, 12, 2);
    topGlow.position.set(-2.2, 4.2, 3.8);
    scene.add(topGlow);

    scene.add(new THREE.HemisphereLight(0xfff8ea, 0x082b33, 1.4));

    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b6269,
      metalness: 0.14,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transmission: 0.07,
      thickness: 1.25,
      ior: 1.38,
      envMapIntensity: 1.5
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.72, 128, 128), orbMat);
    sphere.position.y = 0.46;
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    root.add(sphere);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.61, 96, 96),
      new THREE.MeshBasicMaterial({color:0x13555b,transparent:true,opacity:.16,side:THREE.BackSide})
    );
    inner.position.copy(sphere.position);
    root.add(inner);

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xc79653, metalness: .96, roughness: .18, clearcoat: .5, clearcoatRoughness: .12
    });
    const paleGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8c999, metalness: .92, roughness: .2
    });
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8e9cf, metalness: .2, roughness: .13, clearcoat: 1, clearcoatRoughness: .06
    });

    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(1.735, .035, 24, 160), goldMat);
    rimMesh.position.y = sphere.position.y;
    rimMesh.rotation.x = Math.PI/2;
    root.add(rimMesh);

    const rings = [];
    [
      [2.46,.022,-.48,.10,-.20],
      [2.20,.018,.18,1.08,.34],
      [2.58,.015,.37,.28,.58]
    ].forEach((spec, idx) => {
      const [radius,tube,rx,ry,rz] = spec;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius,tube,18,220), idx===1 ? paleGoldMat : goldMat);
      ring.position.y = sphere.position.y;
      ring.rotation.set(rx,ry,rz);
      ring.castShadow = true;
      root.add(ring);
      rings.push(ring);
    });

    [
      [-1.92,1.55,.58,.17],
      [ 2.02,1.28,.25,.19],
      [-2.18,-.33,.35,.15],
      [ 2.22,-.50,.48,.18]
    ].forEach(([x,y,z,r]) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r,48,48), pearlMat);
      p.position.set(x,y,z);
      p.castShadow = true;
      root.add(p);
    });

    const starShape = new THREE.Shape();
    for (let i=0; i<16; i++) {
      const a = -Math.PI/2 + i*Math.PI*2/16;
      const r = i%2===0 ? .86 : .20;
      const x = Math.cos(a)*r, y = Math.sin(a)*r;
      if (i===0) starShape.moveTo(x,y); else starShape.lineTo(x,y);
    }
    starShape.closePath();

    const starGeo = new THREE.ExtrudeGeometry(starShape,{
      depth:.07,bevelEnabled:true,bevelThickness:.028,bevelSize:.035,bevelSegments:4,curveSegments:4
    });
    starGeo.center();

    const star = new THREE.Mesh(starGeo,goldMat);
    star.position.set(0,.46,1.70);
    star.scale.set(1.1,1.1,1.1);
    star.castShadow = true;
    root.add(star);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(.11,48,48),paleGoldMat);
    jewel.position.set(0,.46,1.82);
    root.add(jewel);

    const marbleMat = new THREE.MeshPhysicalMaterial({
      color:0xf4efe6,roughness:.24,metalness:.03,clearcoat:.42,clearcoatRoughness:.22
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.26,.58,128),marbleMat);
    base.position.y = -1.70;
    base.scale.z = .62;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const bandTop = new THREE.Mesh(new THREE.CylinderGeometry(2.18,2.18,.10,128),goldMat);
    bandTop.position.y = -1.39;
    bandTop.scale.z = .64;
    root.add(bandTop);

    const upperPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.68,.26,128),goldMat);
    upperPlinth.position.y = -1.27;
    upperPlinth.scale.z = .68;
    root.add(upperPlinth);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.24,1.42,.14,128),paleGoldMat);
    topCap.position.y = -1.11;
    topCap.scale.z = .70;
    root.add(topCap);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.9,96),
      new THREE.MeshBasicMaterial({color:0xd7ac6f,transparent:true,opacity:.10,depthWrite:false})
    );
    glow.rotation.x = -Math.PI/2;
    glow.position.y = -2.01;
    root.add(glow);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024; labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    ctx.clearRect(0,0,1024,128);
    ctx.fillStyle = '#6a4d2d';
    ctx.font = '600 52px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BRANDEDALIGN',512,64);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6,.32),
      new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false})
    );
    label.position.set(0,-1.70,1.44);
    root.add(label);

    root.rotation.x = -.015;
    root.rotation.y = -.06;
    root.position.y = .04;

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
        root.rotation.y = -.06 + Math.sin(t*.24)*.035;
        root.position.y = .04 + Math.sin(t*.42)*.035;
        rings[0].rotation.z = -.20 + Math.sin(t*.18)*.025;
        rings[1].rotation.z = .34 + Math.sin(t*.15+1.2)*.020;
        rings[2].rotation.z = .58 + Math.sin(t*.14+2.0)*.018;
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