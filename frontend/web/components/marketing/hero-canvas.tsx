"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient hero visual — a slowly drifting wireframe icosphere with a faint solid
 * core, an ember rim light, and soft dust, over a transparent canvas so the warm
 * page tone shows through. Premium and quiet, not a centrepiece that competes
 * with the headline.
 *
 * three.js is imported lazily inside the effect so it never enters the SSR/main
 * bundle. Honors prefers-reduced-motion (renders one static frame), pauses when
 * scrolled offscreen, caps DPR, and disposes everything on unmount.
 */
export function HeroCanvas({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.z = 6;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      // Palette (matches the ink-on-paper + ember system).
      const ember = new THREE.Color("#C25A3B");
      const ink = new THREE.Color("#2A2723");

      const group = new THREE.Group();
      scene.add(group);

      // Faint solid core.
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6, 1),
        new THREE.MeshStandardMaterial({
          color: ink,
          roughness: 0.55,
          metalness: 0.1,
          transparent: true,
          opacity: 0.18,
          flatShading: true,
        }),
      );
      group.add(core);

      // Ember wireframe shell.
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2, 1),
        new THREE.MeshBasicMaterial({
          color: ember,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
        }),
      );
      group.add(shell);

      // Soft dust.
      const dustCount = 90;
      const positions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 9;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: ember,
          size: 0.045,
          transparent: true,
          opacity: 0.35,
          sizeAttenuation: true,
        }),
      );
      scene.add(dust);

      // Lighting — warm key + ember rim.
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xfff1e6, 1.1);
      key.position.set(3, 4, 5);
      scene.add(key);
      const rim = new THREE.PointLight(ember.getHex(), 18, 30);
      rim.position.set(-4, -2, 2);
      scene.add(rim);

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // Subtle pointer parallax (skip on reduced motion / coarse pointers).
      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
        pointer.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
      };
      const usePointer =
        !reduceMotion && window.matchMedia("(pointer: fine)").matches;
      if (usePointer) window.addEventListener("pointermove", onPointer);

      // Scroll reactivity — the object responds to scrolling the hero so the 3D
      // feels purposeful, not idle. 0 at the top, grows as the hero scrolls away.
      let scrollP = 0;
      let scrollLerp = 0;
      const onScroll = () => {
        const rect = host.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        scrollP = Math.min(Math.max(-rect.top / (vh * 0.9), 0), 1.2);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      let raf = 0;
      let running = false;
      const render = () => {
        // Subtle parallax: drift the camera toward the pointer, never the object.
        camera.position.x += (pointer.x * 1.2 - camera.position.x) * 0.04;
        camera.position.y += (-pointer.y * 1.0 - camera.position.y) * 0.04;
        camera.position.z = 6 + scrollLerp * 1.8; // pull back as you scroll
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      let idleY = 0;
      let idleX = 0;
      const tick = () => {
        idleY += 0.0016;
        idleX += 0.0006;
        scrollLerp += (scrollP - scrollLerp) * 0.08;
        group.rotation.y = idleY + scrollLerp * 2.0;
        group.rotation.x = idleX + scrollLerp * 0.5;
        group.position.y = scrollLerp * 0.7;
        dust.rotation.y -= 0.0004;
        render();
        raf = requestAnimationFrame(tick);
      };
      const start = () => {
        if (running || reduceMotion) return;
        running = true;
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      // Pause when offscreen.
      const io = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? start() : stop()),
        { threshold: 0.01 },
      );
      io.observe(host);

      render(); // first frame immediately (and the only frame on reduced motion)

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        if (usePointer) window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("scroll", onScroll);
        core.geometry.dispose();
        (core.material as { dispose(): void }).dispose();
        shell.geometry.dispose();
        (shell.material as { dispose(): void }).dispose();
        dustGeo.dispose();
        (dust.material as { dispose(): void }).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className={className} />;
}
