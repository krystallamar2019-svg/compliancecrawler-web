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
    camera.position.set(0, 0.18, 9.4);

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
      metalness: 0.12,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      transmission: 0.08,
      thickness: 1.18,
      ior: 1.38,
      envMapIntensity: 1.5
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.58, 128, 128), orbMat);
    sphere.position.y = 0.46;
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    root.add(sphere);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 96, 96),
      new THREE.MeshBasicMaterial({color:0x13555b,transparent:true,opacity:.14,side:THREE.BackSide})
    );
    inner.position.copy(sphere.position);
    root.add(inner);

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0b56a, metalness: .9, roughness: .17, clearcoat: .65, clearcoatRoughness: .10
    });
    const paleGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0d9a9, metalness: .86, roughness: .17, clearcoat: .45, clearcoatRoughness: .10
    });
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf1de, metalness: .12, roughness: .10, clearcoat: 1, clearcoatRoughness: .05
    });

    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(1.595, .027, 24, 160), goldMat);
    rimMesh.position.y = sphere.position.y;
    rimMesh.rotation.x = Math.PI/2;
    root.add(rimMesh);

    const rings = [];
    [
      [2.15,.018,-.48,.10,-.20],
      [1.95,.015,.18,1.08,.34],
      [2.28,.013,.37,.28,.58]
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
      [-1.68,1.43,.52,.14],
      [ 1.72,1.18,.22,.15],
      [-1.86,-.22,.30,.12],
      [ 1.87,-.39,.40,.14]
    ].forEach(([x,y,z,r]) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r,48,48), pearlMat);
      p.position.set(x,y,z);
      p.castShadow = true;
      root.add(p);
    });

    const starShape = new THREE.Shape();
    for (let i=0; i<16; i++) {
      const a = -Math.PI/2 + i*Math.PI*2/16;
      const r = i%2===0 ? .78 : .19;
      const x = Math.cos(a)*r, y = Math.sin(a)*r;
      if (i===0) starShape.moveTo(x,y); else starShape.lineTo(x,y);
    }
    starShape.closePath();

    const starGeo = new THREE.ExtrudeGeometry(starShape,{
      depth:.05,bevelEnabled:true,bevelThickness:.02,bevelSize:.028,bevelSegments:4,curveSegments:4
    });
    starGeo.center();

    const star = new THREE.Mesh(starGeo,goldMat);
    star.position.set(0,.46,1.57);
    star.scale.set(1.0,1.0,1.0);
    star.castShadow = true;
    root.add(star);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(.095,48,48),paleGoldMat);
    jewel.position.set(0,.46,1.68);
    root.add(jewel);

    const marbleMat = new THREE.MeshPhysicalMaterial({
      color:0xf4efe6,roughness:.24,metalness:.03,clearcoat:.42,clearcoatRoughness:.22
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.15,.54,128),marbleMat);
    base.position.y = -1.58;
    base.scale.z = .62;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const bandTop = new THREE.Mesh(new THREE.CylinderGeometry(2.07,2.07,.085,128),goldMat);
    bandTop.position.y = -1.30;
    bandTop.scale.z = .64;
    root.add(bandTop);

    const upperPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.47,1.58,.22,128),goldMat);
    upperPlinth.position.y = -1.19;
    upperPlinth.scale.z = .68;
    root.add(upperPlinth);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.34,.12,128),paleGoldMat);
    topCap.position.y = -1.05;
    topCap.scale.z = .70;
    root.add(topCap);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.65,96),
      new THREE.MeshBasicMaterial({color:0xd7ac6f,transparent:true,opacity:.085,depthWrite:false})
    );
    glow.rotation.x = -Math.PI/2;
    glow.position.y = -1.88;
    root.add(glow);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024; labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    ctx.clearRect(0,0,1024,128);
    ctx.fillStyle = '#7c5a32';
    ctx.font = '600 52px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BRANDEDALIGN',512,64);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.48,.30),
      new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false})
    );
    label.position.set(0,-1.58,1.36);
    root.add(label);

    root.rotation.x = -.015;
    root.rotation.y = -.045;
    root.position.y = .05;
    root.scale.set(.96,.96,.96);

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
        root.rotation.y = -.045 + Math.sin(t*.24)*.028;
        root.position.y = .05 + Math.sin(t*.42)*.028;
        rings[0].rotation.z = -.20 + Math.sin(t*.18)*.020;
        rings[1].rotation.z = .34 + Math.sin(t*.15+1.2)*.017;
        rings[2].rotation.z = .58 + Math.sin(t*.14+2.0)*.015;
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