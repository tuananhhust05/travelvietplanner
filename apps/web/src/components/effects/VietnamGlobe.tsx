'use client';
import { useEffect, useRef } from 'react';

export function VietnamGlobe({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let animId: number;

    const init = async () => {
      const THREE = await import('three');
      const mount = mountRef.current!;
      const W = mount.clientWidth || 400;
      const H = mount.clientHeight || 400;

      // Scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.z = 2.8;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      // Globe geometry
      const globeGeo = new THREE.SphereGeometry(1, 64, 64);

      // Create canvas texture for the globe
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 1024;
      texCanvas.height = 512;
      const ctx = texCanvas.getContext('2d')!;

      // Ocean background — deep teal
      ctx.fillStyle = '#0d2137';
      ctx.fillRect(0, 0, 1024, 512);

      // Draw a subtle grid (lat/long lines)
      ctx.strokeStyle = 'rgba(61,122,94,0.15)';
      ctx.lineWidth = 0.5;
      for (let lat = -80; lat <= 80; lat += 20) {
        const y = ((90 - lat) / 180) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }
      for (let lon = -180; lon <= 180; lon += 20) {
        const x = ((lon + 180) / 360) * 1024;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }

      // Vietnam highlighted region (approximate bounding box on equirectangular)
      // Vietnam: roughly lon 102-110, lat 8-23
      const vnX = ((102 + 180) / 360) * 1024;
      const vnW = ((110 - 102) / 360) * 1024;
      const vnY = ((90 - 23) / 180) * 512;
      const vnH = ((23 - 8) / 180) * 512;

      // Glow effect for Vietnam
      const grad = ctx.createRadialGradient(
        vnX + vnW / 2, vnY + vnH / 2, 0,
        vnX + vnW / 2, vnY + vnH / 2, Math.max(vnW, vnH)
      );
      grad.addColorStop(0, 'rgba(61,122,94,0.8)');
      grad.addColorStop(0.5, 'rgba(61,122,94,0.3)');
      grad.addColorStop(1, 'rgba(61,122,94,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(vnX - vnW, vnY - vnH, vnW * 3, vnH * 3);

      // Vietnam outline (simplified S-curve shape)
      ctx.beginPath();
      ctx.strokeStyle = '#3d7a5e';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(61,122,94,0.5)';
      // Simplified Vietnam shape points (lon/lat)
      const vnPoints: [number, number][] = [
        [104.0, 22.5], [104.5, 21.0], [105.0, 20.0], [106.0, 19.0],
        [107.5, 17.5], [108.5, 16.0], [108.8, 15.0], [109.0, 13.0],
        [108.5, 11.0], [107.0, 10.5], [106.0, 9.5], [104.5, 9.0],
        [103.5, 10.0], [104.0, 11.5], [103.8, 13.5], [104.5, 15.5],
        [106.0, 17.0], [106.5, 18.5], [105.5, 20.0], [104.0, 21.5],
        [103.0, 22.0], [103.5, 23.0], [104.0, 22.5],
      ];
      vnPoints.forEach(([lon, lat], i) => {
        const px = ((lon + 180) / 360) * 1024;
        const py = ((90 - lat) / 180) * 512;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // City dots
      const cities: [number, number, string][] = [
        [105.85, 21.03, 'Hà Nội'],
        [106.66, 10.82, 'TP.HCM'],
        [108.22, 16.07, 'Đà Nẵng'],
        [107.59, 16.47, 'Huế'],
        [108.34, 11.94, 'Đà Lạt'],
      ];
      cities.forEach(([lon, lat]) => {
        const px = ((lon + 180) / 360) * 1024;
        const py = ((90 - lat) / 180) * 512;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#c8973a';
        ctx.fill();
        // Pulse ring
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,151,58,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      const texture = new THREE.CanvasTexture(texCanvas);

      // Globe mesh — subtle jade tint
      const globeMat = new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 15,
        specular: new THREE.Color(0x3d7a5e),
      });
      const globe = new THREE.Mesh(globeGeo, globeMat);
      scene.add(globe);

      // Atmosphere glow
      const atmosGeo = new THREE.SphereGeometry(1.02, 32, 32);
      const atmosMat = new THREE.MeshPhongMaterial({
        color: 0x3d7a5e,
        transparent: true,
        opacity: 0.08,
        side: THREE.FrontSide,
      });
      scene.add(new THREE.Mesh(atmosGeo, atmosMat));

      // Particles — floating stars/dots
      const particleCount = 200;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const r = 1.5 + Math.random() * 1.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({ color: 0x3d7a5e, size: 0.015, transparent: true, opacity: 0.6 });
      scene.add(new THREE.Points(particleGeo, particleMat));

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(5, 3, 5);
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0x3d7a5e, 0.3);
      backLight.position.set(-5, -2, -3);
      scene.add(backLight);

      // Mouse interaction
      const mouse = { x: 0, y: 0 };
      let isDragging = false;
      let lastMouse = { x: 0, y: 0 };
      let velocity = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        lastMouse = { x: e.clientX, y: e.clientY };
      };
      const onMouseUp = () => { isDragging = false; };
      const onMouseMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        if (isDragging) {
          velocity.x = (e.clientX - lastMouse.x) * 0.005;
          velocity.y = (e.clientY - lastMouse.y) * 0.005;
          lastMouse = { x: e.clientX, y: e.clientY };
        }
      };

      // Touch support
      const onTouchStart = (e: TouchEvent) => {
        isDragging = true;
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };
      const onTouchEnd = () => { isDragging = false; };
      const onTouchMove = (e: TouchEvent) => {
        if (!isDragging) return;
        velocity.x = (e.touches[0].clientX - lastMouse.x) * 0.005;
        velocity.y = (e.touches[0].clientY - lastMouse.y) * 0.005;
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };

      mount.addEventListener('mousedown', onMouseDown);
      mount.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove, { passive: true });

      // Animate
      let autoRotY = 0;
      // Position Vietnam front-and-center at start (lon ~107 → offset from 0)
      globe.rotation.y = -((107 + 180) / 360) * Math.PI * 2 + Math.PI;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        autoRotY += 0.002;
        if (!isDragging) {
          velocity.x *= 0.95;
          velocity.y *= 0.95;
        }
        globe.rotation.y += 0.002 + velocity.x;
        globe.rotation.x = Math.max(-0.4, Math.min(0.4, globe.rotation.x + velocity.y * 0.3));
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const onResize = () => {
        const W2 = mount.clientWidth;
        const H2 = mount.clientHeight;
        camera.aspect = W2 / H2;
        camera.updateProjectionMatrix();
        renderer.setSize(W2, H2);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(animId);
        mount.removeEventListener('mousedown', onMouseDown);
        mount.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        globeGeo.dispose();
        globeMat.dispose();
        texture.dispose();
        atmosGeo.dispose();
        atmosMat.dispose();
        particleGeo.dispose();
        particleMat.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    };

    let cleanup: (() => void) | undefined;
    init().then(fn => { cleanup = fn; });
    return () => {
      cleanup?.();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full cursor-grab active:cursor-grabbing ${className}`}
      aria-hidden="true"
    />
  );
}
