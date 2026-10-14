"use client";

import { useEffect, type RefObject } from "react";

/** Resting angle and sway for each phone, in the same order as the `.hp` buttons (left, right, centre). */
const POSES = [
  { yaw: 22, roll: 5, sway: 7, phase: 1.1 },
  { yaw: -22, roll: -5, sway: 7, phase: 2.3 },
  { yaw: 0, roll: 0, sway: 14, phase: 0 },
];
const DEG = Math.PI / 180;
const MODEL = "/models/iphone-16.glb";

/**
 * Real iPhone 16 models for the home page hero, gently swaying side to side.
 * Each phone takes its place and size from the matching `.hp` button, which stays
 * in the page (invisible) to handle taps. Until the model is ready, or where WebGL
 * is unavailable, the flat mockups are shown instead.
 */
export function HeroPhones3D({ stage, screens }: { stage: RefObject<HTMLDivElement | null>; screens: string[] }) {
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      const canvas = document.createElement("canvas");
      canvas.className = "hero-3d";
      canvas.setAttribute("aria-hidden", "true");
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL: keep the flat mockups
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      const key = new THREE.DirectionalLight(0xfff4e2, 1.6);
      key.position.set(-0.6, 1, 1.4);
      scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
      const camera = new THREE.PerspectiveCamera(24, 1, 1, 10000);

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const textures = new THREE.TextureLoader();
      let gltf;
      try {
        gltf = await loader.loadAsync(MODEL);
      } catch {
        renderer.dispose();
        return;
      }
      if (disposed) {
        renderer.dispose();
        return;
      }

      /* centre the model on its own origin and find its screen: the largest flat part facing the front */
      const base = gltf.scene;
      base.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(base);
      const centre = box.getCenter(new THREE.Vector3());
      const height = box.max.y - box.min.y;
      let screen: InstanceType<typeof THREE.Mesh> | null = null;
      let best = 0;
      base.traverse((o) => {
        const m = o as InstanceType<typeof THREE.Mesh>;
        if (!m.isMesh) return;
        const b = new THREE.Box3().setFromObject(m);
        const s = b.getSize(new THREE.Vector3());
        const area = s.x * s.y;
        if (s.z < 0.01 && b.min.z > centre.z && area > best) {
          best = area;
          screen = m;
        }
      });
      const screenName = (screen as InstanceType<typeof THREE.Mesh> | null)?.name ?? "";
      /* the model's screen has no usable texture coordinates; map the image flat across it */
      if (screen) {
        const g = (screen as InstanceType<typeof THREE.Mesh>).geometry;
        g.computeBoundingBox();
        const gb = g.boundingBox!;
        const pos = g.attributes.position;
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) - gb.min.x) / (gb.max.x - gb.min.x);
          uv[i * 2 + 1] = 1 - (pos.getY(i) - gb.min.y) / (gb.max.y - gb.min.y);
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      }

      const phones = screens.map((src) => {
        const model = base.clone(true);
        model.position.sub(centre);
        const pivot = new THREE.Group();
        pivot.add(model);
        const tex = textures.load(src, () => draw());
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        model.traverse((o) => {
          if ((o as InstanceType<typeof THREE.Mesh>).isMesh && o.name === screenName) (o as InstanceType<typeof THREE.Mesh>).material = mat;
        });
        scene.add(pivot);
        return { pivot, tex, mat, hover: 0 };
      });

      const buttons = () => Array.from(el.querySelectorAll<HTMLElement>(".hp"));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

      /* one pixel on the page is one unit at z = 0, so phones line up with their buttons */
      let w = 0, h = 0;
      const layout = () => {
        const r = el.getBoundingClientRect();
        w = r.width;
        h = r.height;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.position.set(0, 0, h / 2 / Math.tan((camera.fov * DEG) / 2));
        camera.updateProjectionMatrix();
        buttons().forEach((b, i) => {
          const p = phones[i];
          if (!p) return;
          /* layout box without the CSS 3D transform: offsetWidth/Height plus the centre of the transformed box */
          const br = b.getBoundingClientRect();
          const ph = b.offsetHeight || br.height;
          p.pivot.position.set(br.left + br.width / 2 - (r.left + w / 2), -(br.top + br.height / 2 - (r.top + h / 2)), i === 2 ? 40 : 0);
          p.pivot.scale.setScalar(ph / height);
        });
      };

      let mx = 0, tmx = 0;
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        tmx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      };
      const hoverOn = (i: number, v: number) => () => { if (phones[i]) phones[i].hover = v; };
      const listeners = buttons().map((b, i) => {
        const on = hoverOn(i, 1), off = hoverOn(i, 0);
        b.addEventListener("pointerenter", on);
        b.addEventListener("pointerleave", off);
        b.addEventListener("focus", on);
        b.addEventListener("blur", off);
        return () => {
          b.removeEventListener("pointerenter", on);
          b.removeEventListener("pointerleave", off);
          b.removeEventListener("focus", on);
          b.removeEventListener("blur", off);
        };
      });
      if (finePointer && !reduced) window.addEventListener("pointermove", onMove, { passive: true });

      const lift = phones.map(() => 0);
      const start = performance.now();
      const pose = (t: number) => {
        mx += (tmx - mx) * 0.06;
        phones.forEach((p, i) => {
          const q = POSES[i] ?? POSES[2];
          const sway = reduced ? 0 : Math.sin(t * 0.55 + q.phase) * q.sway;
          p.pivot.rotation.set(reduced ? 0 : Math.sin(t * 0.4 + q.phase) * 1.5 * DEG, (q.yaw + sway + mx * 6) * DEG, q.roll * DEG);
          lift[i] += (p.hover - lift[i]) * 0.12;
          p.pivot.userData.baseY ??= p.pivot.position.y;
          p.pivot.position.y = p.pivot.userData.baseY + lift[i] * 8 + (reduced ? 0 : Math.sin(t * 0.8 + q.phase) * 3);
        });
      };
      const draw = () => {
        pose((performance.now() - start) / 1000);
        renderer.render(scene, camera);
      };

      let raf = 0, visible = true;
      const loop = () => {
        draw();
        raf = visible && !document.hidden && !reduced ? requestAnimationFrame(loop) : 0;
      };
      const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
      io.observe(el);
      const ro = new ResizeObserver(() => {
        phones.forEach((p) => { delete p.pivot.userData.baseY; });
        layout();
        draw();
      });
      ro.observe(el);
      document.addEventListener("visibilitychange", wake);

      layout();
      el.appendChild(canvas);
      draw();
      el.dataset.three = "ready";
      if (!reduced) wake();

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", wake);
        window.removeEventListener("pointermove", onMove);
        listeners.forEach((off) => off());
        phones.forEach((p) => { p.tex.dispose(); p.mat.dispose(); });
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        canvas.remove();
        delete el.dataset.three;
      };
    };

    /*
     * Start only once the page has loaded and the browser is idle, so downloading three.js and the model
     * never competes with the first paint or the first tap. The flat mockups are already on screen meanwhile.
     * Visitors with Data Saver on keep the flat mockups and skip the download altogether.
     */
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    let idle = 0;
    let timer = 0;
    const run = () => {
      if (!disposed) void start();
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(run, { timeout: 3000 });
      else timer = window.setTimeout(run, 1500);
    };
    if (!saveData) {
      if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, screens.join("|")]);

  return null;
}
