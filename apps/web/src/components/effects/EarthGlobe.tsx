'use client';
import { useEffect, useRef } from 'react';
import type { Vector3 } from 'three';

type GeoFeature = { geometry: { type: string; coordinates: unknown } };

function geoToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

// Build a spherical quad patch that covers lat/lon bounds, using sphere UVs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeGeoQuad(T: any, latMin: number, latMax: number, lonMin: number, lonMax: number, r: number) {
  const SEGS = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= SEGS; row++) {
    const lat = latMax - (latMax - latMin) * (row / SEGS);
    for (let col = 0; col <= SEGS; col++) {
      const lon = lonMin + (lonMax - lonMin) * (col / SEGS);
      const [x, y, z] = geoToXYZ(lat, lon, r);
      positions.push(x, y, z);
      uvs.push(col / SEGS, row / SEGS);
    }
  }
  for (let row = 0; row < SEGS; row++) {
    for (let col = 0; col < SEGS; col++) {
      const a = row * (SEGS + 1) + col;
      const b = a + 1;
      const c = a + (SEGS + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv',       new T.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function EarthGlobe({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const animIdRef = useRef<number>(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const T = await import('three');

      const W = mount.clientWidth || 500;
      const H = mount.clientHeight || 500;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(45, W / H, 0.1, 1000);

      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      // === TEXTURE ===
      const loader = new T.TextureLoader();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let earthTex: any;
      try {
        earthTex = await new Promise((resolve, reject) => {
          loader.load(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            (tex: any) => {
              tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
              tex.minFilter = T.LinearMipmapLinearFilter;
              tex.magFilter = T.LinearFilter;
              tex.generateMipmaps = true;
              resolve(tex);
            },
            undefined, reject,
          );
        });
      } catch {
        const c = document.createElement('canvas');
        c.width = 2048; c.height = 1024;
        const ctx = c.getContext('2d')!;
        const og = ctx.createLinearGradient(0, 0, 0, 1024);
        og.addColorStop(0, '#0d2137'); og.addColorStop(1, '#071420');
        ctx.fillStyle = og; ctx.fillRect(0, 0, 2048, 1024);
        ctx.strokeStyle = 'rgba(61,122,94,0.15)'; ctx.lineWidth = 1;
        for (let lat = -80; lat <= 80; lat += 15) {
          const y = ((90 - lat) / 180) * 1024;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
        }
        for (let lon = -180; lon <= 180; lon += 15) {
          const x = ((lon + 180) / 360) * 2048;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
        }
        earthTex = new T.CanvasTexture(c);
      }

      // Globe — stays at rotation (0,0,0). Camera orbits around it.
      const globe = new T.Mesh(
        new T.SphereGeometry(1, 64, 64),
        new T.MeshPhongMaterial({ map: earthTex, shininess: 15, specular: new T.Color(0x1a3a5c) }),
      );
      scene.add(globe);

      // High-res SEA overlay — loaded lazily, fades in at phase 3
      // Covers lat 5–25 / lon 100–115 (Vietnam + surrounding)
      const seaOverlay = new T.Mesh(
        makeGeoQuad(T, 5, 25, 100, 115, 1.002),
        new T.MeshPhongMaterial({
          transparent: true, opacity: 0, depthWrite: false,
          shininess: 10, specular: new T.Color(0x1a3a5c),
        }),
      );
      scene.add(seaOverlay);

      // Load SEA high-res texture async (non-blocking)
      loader.load(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/27/53',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tex: any) => {
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.minFilter = T.LinearMipmapLinearFilter;
          tex.magFilter = T.LinearFilter;
          tex.generateMipmaps = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (seaOverlay.material as any).map = tex;
          seaOverlay.material.needsUpdate = true;
        },
        undefined,
        // Fallback: try NASA Visible Earth tile
        () => {
          loader.load(
            'https://unpkg.com/three-globe/example/img/earth-day.jpg',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (tex: any) => {
              tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
              // Crop to SEA region via UV offset/repeat
              tex.offset.set(100 / 360 + 0.5, (90 - 25) / 180);
              tex.repeat.set(15 / 360, 20 / 180);
              tex.wrapS = T.RepeatWrapping;
              tex.wrapT = T.RepeatWrapping;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (seaOverlay.material as any).map = tex;
              seaOverlay.material.needsUpdate = true;
            },
            undefined, () => {},
          );
        },
      );

      // Atmosphere
      scene.add(new T.Mesh(
        new T.SphereGeometry(1.03, 32, 32),
        new T.MeshPhongMaterial({ color: 0x3d7a5e, transparent: true, opacity: 0.07, side: T.FrontSide }),
      ));

      // Stars
      const starPos = new Float32Array(3000);
      for (let i = 0; i < 1000; i++) {
        const r = 6 + Math.random() * 4;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
        starPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
        starPos[i*3+2] = r * Math.cos(ph);
      }
      const starGeo = new T.BufferGeometry();
      starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
      scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0xaaccff, size: 0.015, transparent: true, opacity: 0.6 })));

      // === BORDERS ===
      const borderGroup = new T.Group();
      scene.add(borderGroup);

      function addLine(coords: number[][], color: number, opacity: number, r: number) {
        if (coords.length < 2) return;
        const pts: number[] = [];
        for (const [lon, lat] of coords) {
          const [x, y, z] = geoToXYZ(lat, lon, r);
          pts.push(x, y, z);
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3));
        borderGroup.add(new T.Line(geo, new T.LineBasicMaterial({ color, transparent: true, opacity })));
      }

      function processGeo(geom: GeoFeature['geometry'], color: number, opacity: number, r: number) {
        const { type, coordinates: co } = geom;
        if (type === 'LineString') addLine(co as number[][], color, opacity, r);
        else if (type === 'MultiLineString') (co as number[][][]).forEach(l => addLine(l, color, opacity, r));
        else if (type === 'Polygon') (co as number[][][]).forEach(ring => addLine(ring, color, opacity, r));
        else if (type === 'MultiPolygon') (co as number[][][][]).forEach(p => p.forEach(ring => addLine(ring, color, opacity, r)));
      }

      fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(r => r.ok ? r.json() : null)
        .then((d: { features: GeoFeature[] } | null) => {
          if (d) d.features.forEach(f => processGeo(f.geometry, 0x4a90d9, 0.28, 1.003));
        }).catch(() => {});

      fetch('https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions-json-based/main/vn_a1.json')
        .then(r => r.ok ? r.json() : null)
        .then((d: { features: GeoFeature[] } | null) => {
          if (d) d.features.forEach(f => processGeo(f.geometry, 0x5dbb8a, 0.65, 1.004));
        }).catch(() => {});

      // === CITIES ===
      const cities: [string, number, number][] = [
        ['Hà Nội',   21.03, 105.85],
        ['TP.HCM',   10.82, 106.66],
        ['Đà Nẵng',  16.07, 108.22],
        ['Hạ Long',  20.96, 107.05],
        ['Hội An',   15.88, 108.33],
      ];

      const pinGroup = new T.Group();
      pinGroup.visible = false;
      scene.add(pinGroup);

      cities.forEach(([, lat, lon]) => {
        const [x, y, z] = geoToXYZ(lat, lon, 1.013);
        const pos = new T.Vector3(x, y, z);
        const pin = new T.Mesh(
          new T.SphereGeometry(0.003, 8, 8),
          new T.MeshBasicMaterial({ color: 0xf5c96a }),
        );
        pin.position.copy(pos);
        pinGroup.add(pin);
        const ring = new T.Mesh(
          new T.RingGeometry(0.004, 0.007, 16),
          new T.MeshBasicMaterial({ color: 0xf5c96a, transparent: true, opacity: 0.6, side: T.DoubleSide }),
        );
        ring.position.copy(pos);
        ring.lookAt(pos.clone().multiplyScalar(2));
        pinGroup.add(ring);
      });

      // HTML labels
      mount.style.position = 'relative';
      const labelCont = document.createElement('div');
      labelCont.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
      mount.appendChild(labelCont);
      const labelEls = cities.map(([name]) => {
        const el = document.createElement('div');
        el.textContent = name;
        el.style.cssText = 'position:absolute;font-size:11px;font-weight:700;color:#f5c96a;'
          + 'text-shadow:0 0 8px #000;background:rgba(8,18,12,0.8);'
          + 'border:1px solid rgba(245,201,106,0.5);border-radius:4px;padding:2px 6px;'
          + 'white-space:nowrap;opacity:0;transition:opacity 0.3s;'
          + 'transform:translate(-50%,-160%);pointer-events:none;';
        labelCont.appendChild(el);
        return el;
      });

      // Lighting
      scene.add(new T.AmbientLight(0xffffff, 0.6));
      const sun = new T.DirectionalLight(0xffffff, 1.4);
      sun.position.set(5, 3, 5);
      scene.add(sun);
      const fill = new T.DirectionalLight(0x3d7a5e, 0.25);
      fill.position.set(-4, -2, -3);
      scene.add(fill);

      // === CAMERA ORBIT APPROACH ===
      // Vietnam position on the static globe (no globe rotation needed)
      const [vnX, vnY, vnZ] = geoToXYZ(16, 106, 1);
      const vnDir = new T.Vector3(vnX, vnY, vnZ).normalize();

      const DIST_FAR  = 3.0;
      const DIST_NEAR = 1.55;

      // Phase timings
      const P0 = 2.0;   // free orbit
      const P1 = 5.0;   // arrive at Vietnam
      const P2 = 7.5;   // zoom done → stop

      const ease  = (t: number) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      const lerp  = (a: number, b: number, t: number) => a+(b-a)*t;
      const clamp = (t: number) => Math.max(0, Math.min(1, t));

      // Camera spherical coords for drag
      let camTheta = Math.atan2(vnDir.x, vnDir.z);
      let camPhi   = Math.asin(Math.max(-0.99, Math.min(0.99, vnDir.y)));
      let isDragging = false;
      let lastX = 0, lastY = 0;
      let phase3Done = false;

      // Spin theta during phase 0
      let spinTheta = 0;

      const onDown  = (e: MouseEvent)  => { if (!phase3Done) return; isDragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onUp    = ()               => { isDragging = false; };
      const onMove  = (e: MouseEvent)  => {
        if (!isDragging) return;
        camTheta -= (e.clientX - lastX) * 0.005;
        camPhi   += (e.clientY - lastY) * 0.003;
        camPhi = Math.max(-0.7, Math.min(0.7, camPhi));
        lastX = e.clientX; lastY = e.clientY;
      };
      const onTouchStart = (e: TouchEvent) => { if (!phase3Done) return; isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; };
      const onTouchMove  = (e: TouchEvent) => {
        if (!isDragging) return;
        camTheta -= (e.touches[0].clientX - lastX) * 0.005;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      };

      mount.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup',   onUp);
      window.addEventListener('mousemove', onMove);
      mount.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend',  onUp);
      window.addEventListener('touchmove', onTouchMove,  { passive: true });

      const tmpVec    = new T.Vector3();
      const startTime = performance.now();

      // Direction where camera starts phase 0 spin
      const startTheta = 0;  // lon=0 facing camera at start
      let spinEnd: Vector3 | null = null;

      const animate = () => {
        animIdRef.current = requestAnimationFrame(animate);
        const t = (performance.now() - startTime) / 1000;

        if (t < P0) {
          // Phase 0: camera orbits freely around Y axis
          spinTheta = startTheta + t * 0.6;
          camera.position.set(
            Math.sin(spinTheta) * DIST_FAR,
            0.4,
            Math.cos(spinTheta) * DIST_FAR,
          );
          camera.lookAt(0, 0, 0);
        } else if (t < P1) {
          // Phase 1: camera travels to Vietnam direction
          if (!spinEnd) {
            spinEnd = camera.position.clone().normalize();
          }
          const p = ease(clamp((t - P0) / (P1 - P0)));
          // Slerp from spin position to Vietnam direction
          const dir = new T.Vector3().copy(spinEnd).lerp(vnDir, p).normalize();
          camera.position.copy(dir.multiplyScalar(DIST_FAR));
          camera.lookAt(0, 0, 0);
        } else if (t < P2) {
          // Phase 2: zoom in toward Vietnam
          const p = ease(clamp((t - P1) / (P2 - P1)));
          const dist = lerp(DIST_FAR, DIST_NEAR, p);
          camera.position.copy(vnDir.clone().multiplyScalar(dist));
          camera.lookAt(0, 0, 0);
        } else {
          // Phase 3: fully stopped — no drift, pins visible, overlay fades in
          if (!phase3Done) {
            phase3Done = true;
            pinGroup.visible = true;
            camTheta = Math.atan2(vnDir.x, vnDir.z);
            camPhi   = Math.asin(Math.max(-0.99, Math.min(0.99, vnDir.y)));
          }

          // No drift — camera is completely still unless user drags
          const cy = Math.sin(camPhi);
          const cr = Math.cos(camPhi);
          camera.position.set(
            Math.sin(camTheta) * cr * DIST_NEAR,
            cy * DIST_NEAR,
            Math.cos(camTheta) * cr * DIST_NEAR,
          );
          camera.lookAt(0, 0, 0);

          // Fade in SEA overlay
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mat = seaOverlay.material as any;
          if (mat.opacity < 1) {
            mat.opacity = Math.min(1, mat.opacity + 0.008);
          }

          // Pulse rings (odd-indexed children of pinGroup)
          const pulse = (Math.sin(t * 2.5) * 0.5 + 0.5) * 0.45 + 0.1;
          pinGroup.children.forEach((child, i) => {
            if (i % 2 === 1 && 'material' in child) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child as any).material.opacity = pulse;
            }
          });

          // City labels
          cities.forEach(([, lat, lon], idx) => {
            const [cx, cy2, cz] = geoToXYZ(lat, lon, 1.013);
            const wp = new T.Vector3(cx, cy2, cz);
            const camDir = camera.position.clone().normalize();
            const facing = wp.clone().normalize().dot(camDir) > 0.3;
            if (facing) {
              tmpVec.copy(wp).project(camera);
              const cw = renderer.domElement.clientWidth;
              const ch = renderer.domElement.clientHeight;
              labelEls[idx].style.left    = `${(tmpVec.x  * 0.5 + 0.5) * cw}px`;
              labelEls[idx].style.top     = `${(-tmpVec.y * 0.5 + 0.5) * ch}px`;
              labelEls[idx].style.opacity = '1';
            } else {
              labelEls[idx].style.opacity = '0';
            }
          });
        }

        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const W2 = mount.clientWidth  || 500;
        const H2 = mount.clientHeight || 500;
        camera.aspect = W2 / H2;
        camera.updateProjectionMatrix();
        renderer.setSize(W2, H2);
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        cancelAnimationFrame(animIdRef.current);
        mount.removeEventListener('mousedown',  onDown);
        window.removeEventListener('mouseup',   onUp);
        window.removeEventListener('mousemove', onMove);
        mount.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchend',  onUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('resize',    onResize);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        if (mount.contains(labelCont))           mount.removeChild(labelCont);
      };
    })();

    return () => { cleanup?.(); cancelAnimationFrame(animIdRef.current); };
  }, []);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}
