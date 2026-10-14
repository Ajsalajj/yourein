/**
 * Renders the two-phone picture on each template card from the real iPhone model
 * (public/models/iphone-16.glb): the sealed cover on a phone behind, the opened
 * invitation on a phone in front, soft shadow baked in, transparent background.
 *
 *   node scripts/make-phone-renders.mjs            every design
 *   node scripts/make-phone-renders.mjs rose-garden one design
 *
 * Writes public/renders/<slug>.webp. Run again after changing a design's catalog
 * images (npm run thumbs) so the cards match.
 */
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = process.cwd();
const sharp = createRequire(root + "/")("sharp");
const OUT = path.join(root, "public", "renders");
const W = 900, H = 1080;

const slugs = readdirSync(path.join(root, "public", "thumbs"))
  .filter((f) => f.endsWith(".webp") && !f.endsWith("-alt.webp"))
  .map((f) => f.replace(".webp", ""))
  .filter((s) => !process.argv[2] || s === process.argv[2]);

/* the page that draws the phones; three.js and the files are served from disk below */
const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="${W}" height="${H}"></canvas>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(${W}, ${H}, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xfff4e2, 1.5);
key.position.set(-0.6, 1, 1.4);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
const camera = new THREE.PerspectiveCamera(22, ${W} / ${H}, 1, 1000);
camera.position.set(0, 0, 64);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync("/models/iphone-16.glb");
const base = gltf.scene;
base.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(base);
const centre = box.getCenter(new THREE.Vector3());
/* the screen: the largest flat part facing the front; give it flat texture coordinates */
let screen = null, best = 0;
base.traverse((o) => {
  if (!o.isMesh) return;
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
  if (s.z < 0.01 && b.min.z > centre.z && s.x * s.y > best) { best = s.x * s.y; screen = o; }
});
const g = screen.geometry;
g.computeBoundingBox();
const gb = g.boundingBox, pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
for (let i = 0; i < pos.count; i++) {
  uv[i * 2] = (pos.getX(i) - gb.min.x) / (gb.max.x - gb.min.x);
  uv[i * 2 + 1] = 1 - (pos.getY(i) - gb.min.y) / (gb.max.y - gb.min.y);
}
g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

const tex = new THREE.TextureLoader();
const phone = (x, y, z, ry, rz) => {
  const m = base.clone(true);
  m.position.sub(centre);
  const p = new THREE.Group();
  p.add(m);
  p.position.set(x, y, z);
  p.rotation.set(0, ry * Math.PI / 180, rz * Math.PI / 180);
  scene.add(p);
  return { p, m };
};
/* sealed cover behind on the left, opened invitation in front on the right */
const back = phone(-3.6, 0.4, -3, 22, 6);
const front = phone(2.6, -0.6, 0, -14, 0);
const setScreen = (ph, src) => new Promise((res) => {
  tex.load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    ph.m.traverse((o) => { if (o.isMesh && o.name === screen.name) o.material = mat; });
    res();
  });
});
window.renderPair = async (slug) => {
  await Promise.all([setScreen(back, "/thumbs/" + slug + "-alt.webp"), setScreen(front, "/thumbs/" + slug + ".webp")]);
  renderer.render(scene, camera);
  return document.getElementById("c").toDataURL("image/png");
};
window.ready = true;
</script></body></html>`;

const types = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".webp": "image/webp" };
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.route("http://render.local/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  if (p === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
  const file = p.startsWith("/three/") ? path.join(root, "node_modules", p) : path.join(root, "public", p);
  route.fulfill({ contentType: types[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://render.local/");
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

mkdirSync(OUT, { recursive: true });
for (const slug of slugs) {
  const data = await page.evaluate((s) => window.renderPair(s), slug);
  const png = Buffer.from(data.split(",")[1], "base64");
  /* trim, then bake a soft shadow underneath from the phones' own outline */
  const phones = await sharp(png).trim().toBuffer();
  const { width, height } = await sharp(phones).metadata();
  const pad = 60;
  const silhouette = await sharp({ create: { width, height, channels: 4, background: { r: 40, g: 28, b: 10, alpha: 1 } } })
    .composite([{ input: await sharp(phones).ensureAlpha().extractChannel("alpha").toBuffer(), blend: "dest-in" }]).png().toBuffer();
  const blurred = await sharp(silhouette).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(26)
    .composite([{ input: Buffer.from([255, 255, 255, Math.round(255 * 0.22)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: "dest-in" }]).png().toBuffer();
  const drop = 30;
  const out = await sharp({ create: { width: width + pad * 2, height: height + pad * 2 + drop, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: blurred, top: drop, left: 0 }, { input: phones, top: pad, left: pad }])
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(path.join(OUT, `${slug}.webp`));
  console.log(slug.padEnd(22), `${out.width}x${out.height}`, `${Math.round(out.size / 1024)} KB`);
}
await browser.close();
