"use client";

import { useEffect, useRef } from "react";

/**
 * The LockIn day ring in 3D: five glowing arcs that fill as the day fills, a glossy padlock
 * in the middle that snaps shut at 100, orbiting orbs and a starfield. Follows the pointer.
 * three.js is loaded only here, after the page is interactive.
 */
type Props = {
  values: number[]; // 0..1 per part
  colors: string[]; // CSS variable names, e.g. "--violet"
  locked: boolean;
  onFail: () => void;
};

export default function Ring3D({ values, colors, locked, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ values, locked });
  const failRef = useRef(onFail);
  // The render loop reads the latest values from here
  useEffect(() => {
    state.current = { values, locked };
    failRef.current = onFail;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      // ---------- renderer ----------
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        failRef.current();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.4, 10.5);

      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#8f80ff";
      const isLight = () => document.documentElement.dataset.theme === "light";

      // ---------- lights ----------
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(3, 5, 6);
      scene.add(key);
      const rimA = new THREE.PointLight(0x8f80ff, 30, 20);
      rimA.position.set(4, 2, 3);
      scene.add(rimA);
      const rimB = new THREE.PointLight(0x46d4ea, 22, 20);
      rimB.position.set(-4, -2, 3);
      scene.add(rimB);

      // ---------- soft glow texture ----------
      const glowTex = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d")!;
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const glow = (color: string, scale: number, opacity = 0.6) => {
        const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        const s = new THREE.Sprite(m);
        s.scale.setScalar(scale);
        return s;
      };

      // ---------- the rig (everything that tilts with the pointer) ----------
      const rig = new THREE.Group();
      rig.rotation.x = -0.32;
      scene.add(rig);

      const halo = glow(css("--violet"), 7, 0.35);
      halo.position.z = -1;
      rig.add(halo);

      // ---------- ring: 5 arcs ----------
      const N = colors.length;
      const R = 2.45;
      const TUBE = 0.15;
      const GAP = 0.09; // radians between arcs
      const span = (Math.PI * 2) / N - GAP;
      const ring = new THREE.Group();
      rig.add(ring);

      type Arc = { pivot: InstanceType<typeof THREE.Group>; fill: InstanceType<typeof THREE.Mesh>; track: InstanceType<typeof THREE.Mesh>; head: InstanceType<typeof THREE.Mesh>; headGlow: InstanceType<typeof THREE.Sprite>; mat: InstanceType<typeof THREE.MeshStandardMaterial>; trackMat: InstanceType<typeof THREE.MeshBasicMaterial>; shown: number };
      const arcs: Arc[] = colors.map((v, i) => {
        const color = css(v);
        const pivot = new THREE.Group();
        // start at the top and go clockwise, like the 2D ring
        pivot.rotation.z = Math.PI / 2 - i * (span + GAP) - GAP / 2;
        pivot.scale.x = -1; // draw clockwise
        ring.add(pivot);
        const trackMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false });
        const track = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE * 0.9, 12, 64, span), trackMat);
        pivot.add(track);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.85, roughness: 0.28, metalness: 0.25 });
        const fill = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 16, 4, 0.0001), mat);
        pivot.add(fill);
        const head = new THREE.Mesh(new THREE.SphereGeometry(TUBE * 1.05, 20, 16), mat);
        pivot.add(head);
        const headGlow = glow(color, 0.9, 0.8);
        pivot.add(headGlow);
        return { pivot, fill, track, head, headGlow, mat, trackMat, shown: -1 };
      });

      const setArc = (a: Arc, v: number) => {
        const p = Math.max(0, Math.min(1, v));
        if (Math.abs(p - a.shown) < 0.004) return;
        a.shown = p;
        const angle = Math.max(0.0001, span * p);
        a.fill.geometry.dispose();
        a.fill.geometry = new THREE.TorusGeometry(R, TUBE, 16, Math.max(4, Math.round(72 * p)), angle);
        const x = Math.cos(angle) * R;
        const y = Math.sin(angle) * R;
        a.head.position.set(x, y, 0);
        a.headGlow.position.set(x, y, 0.05);
        a.head.visible = a.headGlow.visible = p > 0.01;
        a.fill.visible = p > 0.002;
      };

      // ---------- padlock ----------
      const lock = new THREE.Group();
      rig.add(lock);
      const bodyShape = new THREE.Shape();
      const bw = 1.5;
      const bh = 1.18;
      const br = 0.28;
      bodyShape.moveTo(-bw / 2 + br, -bh / 2);
      bodyShape.lineTo(bw / 2 - br, -bh / 2);
      bodyShape.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + br);
      bodyShape.lineTo(bw / 2, bh / 2 - br);
      bodyShape.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - br, bh / 2);
      bodyShape.lineTo(-bw / 2 + br, bh / 2);
      bodyShape.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - br);
      bodyShape.lineTo(-bw / 2, -bh / 2 + br);
      bodyShape.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + br, -bh / 2);
      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 6, curveSegments: 16 });
      bodyGeo.center();
      const bodyMat = new THREE.MeshPhysicalMaterial({ color: css("--violet"), metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: css("--violet"), emissiveIntensity: 0.12 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = -0.35;
      lock.add(body);
      // keyhole
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x0d1130 });
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24), holeMat);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(0, -0.28, 0.36);
      lock.add(hole);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.1), holeMat);
      slot.position.set(0, -0.46, 0.36);
      lock.add(slot);
      // shackle: an arch with two legs; it lifts and swings open until the day is full
      const shackleMat = new THREE.MeshPhysicalMaterial({ color: 0xe6e8ff, metalness: 0.35, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
      const shackle = new THREE.Group();
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.11, 18, 48, Math.PI), shackleMat);
      arch.position.y = 0.62;
      shackle.add(arch);
      for (const sx of [-0.46, 0.46]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.62, 18), shackleMat);
        leg.position.set(sx, 0.31, 0);
        shackle.add(leg);
      }
      // pivot around the right leg
      const shacklePivot = new THREE.Group();
      shacklePivot.position.set(0.46, 0.05, 0);
      shackle.position.x = -0.46;
      shacklePivot.add(shackle);
      lock.add(shacklePivot);
      const lockGlow = glow(css("--mint"), 3.2, 0);
      lockGlow.position.z = -0.7; // behind the lock, so it lights the edges instead of washing out the front
      lock.add(lockGlow);

      // ---------- orbiting orbs ----------
      const orbs = colors.map((v, i) => {
        const color = css(v);
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
        g.add(m);
        g.add(glow(color, 0.8, 0.9));
        rig.add(g);
        return { g, r: 3.35 + (i % 2) * 0.35, speed: 0.22 + i * 0.045, phase: (i / N) * Math.PI * 2, tilt: 0.35 + i * 0.18 };
      });

      // ---------- starfield ----------
      const COUNT = window.innerWidth < 640 ? 350 : 700;
      const pos = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const r = 6 + Math.random() * 10;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        pos[i * 3 + 2] = r * Math.cos(ph) - 4;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const starMat = new THREE.PointsMaterial({ size: 0.05, color: 0xbfc4ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      // ---------- burst when the lock snaps shut ----------
      const BURST = 90;
      const burstPos = new Float32Array(BURST * 3);
      const burstVel: number[] = [];
      const burstGeo = new THREE.BufferGeometry();
      burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPos, 3));
      const burstMat = new THREE.PointsMaterial({ size: 0.16, color: css("--mint"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex });
      rig.add(new THREE.Points(burstGeo, burstMat));
      let burstT = -1;
      const fireBurst = () => {
        burstVel.length = 0;
        for (let i = 0; i < BURST; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 2 + Math.random() * 3.5;
          burstPos[i * 3] = 0;
          burstPos[i * 3 + 1] = 0;
          burstPos[i * 3 + 2] = 0.3;
          burstVel.push(Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 2);
        }
        burstGeo.attributes.position.needsUpdate = true;
        burstT = 0;
      };

      // ---------- theme changes ----------
      const applyTheme = () => {
        colors.forEach((v, i) => {
          const c = css(v);
          arcs[i].mat.color.set(c);
          arcs[i].mat.emissive.set(c);
          arcs[i].trackMat.color.set(c);
          (arcs[i].headGlow.material as InstanceType<typeof THREE.SpriteMaterial>).color.set(c);
        });
        bodyMat.color.set(css("--violet"));
        bodyMat.emissive.set(css("--violet"));
        holeMat.color.set(isLight() ? 0x1b1f45 : 0x0d1130);
        starMat.color.set(isLight() ? 0x6b5bf0 : 0xbfc4ff);
        starMat.opacity = isLight() ? 0.5 : 0.8;
        for (const a of arcs) a.trackMat.opacity = isLight() ? 0.2 : 0.13;
        renderer.toneMappingExposure = isLight() ? 1.0 : 1.15;
      };
      applyTheme();
      const themeObs = new MutationObserver(applyTheme);
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      // ---------- size, pointer, visibility ----------
      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      const pointer = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

      let visible = true;
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
      io.observe(el);

      // ---------- animation loop ----------
      const clock = new THREE.Clock();
      let open = 1; // 1 = shackle open, 0 = shut
      let wasLocked = false;
      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const { locked: isLocked } = state.current;
        const vals = state.current.values.map((v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0));

        vals.forEach((v, i) => setArc(arcs[i], v));

        // pointer parallax and a slow idle sway
        const tx = reduce ? 0 : pointer.y * 0.18;
        const ty = reduce ? 0 : pointer.x * 0.32 + Math.sin(t * 0.35) * 0.12;
        rig.rotation.x += (-0.32 + tx - rig.rotation.x) * 0.05;
        rig.rotation.y += (ty - rig.rotation.y) * 0.05;
        ring.rotation.z = reduce ? 0 : Math.sin(t * 0.25) * 0.04;
        lock.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.06;

        // shackle: opens fully at 0, closes as the day fills, snaps shut at 100
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const target = isLocked ? 0 : 1 - avg * 0.55;
        open += (target - open) * (isLocked ? 0.25 : 0.08);
        shacklePivot.position.y = 0.05 + open * 0.32;
        shacklePivot.rotation.y = open * 0.75;
        if (isLocked && !wasLocked) fireBurst();
        wasLocked = isLocked;
        (lockGlow.material as InstanceType<typeof THREE.SpriteMaterial>).opacity += ((isLocked ? (isLight() ? 0.35 : 0.6) : 0) - (lockGlow.material as InstanceType<typeof THREE.SpriteMaterial>).opacity) * 0.08;
        const pulse = isLocked ? 1 + Math.max(0, 0.08 - (burstT < 0 ? 0 : burstT) * 0.08) : 1;
        ring.scale.setScalar(pulse);
        halo.material.opacity = 0.22 + avg * 0.25;

        // orbs
        for (const o of orbs) {
          const a = o.phase + t * (reduce ? 0 : o.speed);
          o.g.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r * Math.cos(o.tilt), Math.sin(a) * o.r * Math.sin(o.tilt) * 0.6);
        }

        // burst
        if (burstT >= 0) {
          burstT += dt;
          for (let i = 0; i < BURST; i++) {
            burstPos[i * 3] += burstVel[i * 3] * dt;
            burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt;
            burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt;
          }
          burstGeo.attributes.position.needsUpdate = true;
          burstMat.opacity = Math.max(0, 1 - burstT / 1.4);
          if (burstT > 1.4) burstT = -1;
        }

        stars.rotation.y = t * 0.012;
        stars.rotation.x = t * 0.006;
        renderer.render(scene, camera);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        ro.disconnect();
        io.disconnect();
        themeObs.disconnect();
        scene.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>;
          m.geometry?.dispose?.();
          const mat = m.material as { dispose?: () => void } | { dispose?: () => void }[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
          else mat?.dispose?.();
        });
        glowTex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => failRef.current());

    return () => {
      disposed = true;
      cleanup();
    };
  }, [colors]);

  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
