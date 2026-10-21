import test from "node:test";
import assert from "node:assert/strict";
import { AE_PRESETS, evalKeys, key, opacityOf, permutation, presetAmounts, selectorAmounts, type Selector } from "../src/lib/aeselector";
import { BEHAVIOR_MAP } from "../src/remotion/animations/behaviors";

const SEL = (o: Partial<Selector> = {}): Selector => ({ units: "chars", shape: "rampUp", start: 0, end: 100, offset: 0, smoothness: 0, randomize: false, seed: 0, easeHigh: 0, easeLow: 0, ...o });

test("keyframes: linear between, held outside", () => {
  const k = key([10, 0], [20, 100]);
  assert.equal(evalKeys(k, 0), 0); assert.equal(evalKeys(k, 15), 50); assert.equal(evalKeys(k, 99), 100); assert.equal(evalKeys(5, 3), 5);
});

test("seeded permutation is a permutation, repeatable, and changes with the seed", () => {
  const a = permutation(12, 3);
  assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: 12 }, (_, i) => i));
  assert.deepEqual(a, permutation(12, 3));
  assert.notDeepEqual(a, permutation(12, 4));
});

test("ramp up sweep (offset -100 -> +100) takes every unit from 1 to 0, left units first; ramp down is the exit (0 -> 1)", () => {
  const up = (o: number) => selectorAmounts(SEL({ offset: o }), 6, 0);
  assert.ok(up(-100).every((a) => a === 1) && up(100).every((a) => a === 0));
  const mid = up(-40);
  assert.ok(mid[0] < mid[5] || mid[0] === 0, "left units are already visible while right ones are still hidden");
  for (let o = -100; o < 100; o += 10) up(o).forEach((a, i) => assert.ok(up(o + 10)[i] <= a + 1e-9, "amount never increases during an entrance"));
  const down = (o: number) => selectorAmounts(SEL({ shape: "rampDown", offset: o }), 6, 0);
  assert.ok(down(-100).every((a) => a === 0) && down(100).every((a) => a === 1));
  for (let o = -100; o < 100; o += 10) down(o).forEach((a, i) => assert.ok(down(o + 10)[i] >= a - 1e-9));
});

test("square selector with start 0 -> 100 uncovers units one by one (letter flicker / fade-up IN)", () => {
  const at = (start: number) => selectorAmounts(SEL({ shape: "square", start }), 5, 0);
  assert.deepEqual(at(0), [1, 1, 1, 1, 1]);
  assert.deepEqual(at(100), [0, 0, 0, 0, 0]);
  assert.deepEqual(at(50), [0, 0, 0.0, 1, 1].map((x, i) => (i === 2 ? 1 : x)).map((x, i) => (i < 2 ? 0 : x)), "units whose centre is below the start are released");
});

test("randomised selectors reshuffle with the seed (the 'blink')", () => {
  const a = selectorAmounts(SEL({ randomize: true, seed: 1, offset: 0 }), 10, 0), b = selectorAmounts(SEL({ randomize: true, seed: 2, offset: 0 }), 10, 0);
  assert.notDeepEqual(a, b);
  assert.deepEqual([...a].sort(), [...selectorAmounts(SEL({ offset: 0 }), 10, 0)].sort(), "same set of amounts, different assignment");
});

test("decoded presets: timing/parameters are exactly what was read from the .ffx files", () => {
  const wb = AE_PRESETS["word-blink"];
  assert.deepEqual([wb.fps, wb.lengthFrames, wb.animators[0].selector.randomize, wb.animators[0].selector.shape, wb.animators[0].selector.units, wb.animators[0].props.opacity], [24, 14, true, "rampUp", "words", 0]);
  assert.equal(evalKeys(wb.animators[0].selector.seed, 14), 145);
  assert.equal(evalKeys(AE_PRESETS["alphabet-blink"].animators[0].selector.seed, 12), 32);
  const b = AE_PRESETS["bottom-up-blurred"].animators[0];
  assert.deepEqual([b.props.y, b.props.blur, b.props.opacity, evalKeys(b.selector.offset, 42)], [57, 59, 0, 100]);
  assert.equal(evalKeys(AE_PRESETS["letter-flicker"].animators[0].selector.seed, 35), 172);
  assert.equal(evalKeys(AE_PRESETS["smooth-fade-in-out"].trackingKeys!, 94), 5);
});

test("entrance presets start fully hidden and end fully visible; blink presets pass through partial states", () => {
  for (const id of ["word-blink", "alphabet-blink", "bottom-up-blurred", "letter-flicker"]) {
    const p = AE_PRESETS[id], n = 9;
    const first = presetAmounts(p, 0, n, 0), last = presetAmounts(p, 0, n, (p.lengthFrames * 1000) / p.fps + 50);
    assert.ok(first.every((a) => a > 0.99) || id === "letter-flicker" && first.every((a) => a > 0.99), `${id} starts hidden`);
    assert.ok(last.every((a) => a < 0.01), `${id} ends visible`);
    assert.equal(opacityOf(p, [last], 0), 1);
    let partial = 0;
    for (let ms = 0; ms < (p.lengthFrames * 1000) / p.fps; ms += 20) if (presetAmounts(p, 0, n, ms).some((a) => a > 0.1 && a < 0.9)) partial++;
    assert.ok(partial > 3, `${id} has in-between states`);
  }
});

test("exit sweeps are anchored to the end of the caption: visible long before, hidden at the end", () => {
  for (const id of ["smooth-fade-in-out", "fade-up-out-smooth"]) {
    const p = AE_PRESETS[id], k = p.animators.length - 1;
    assert.ok(presetAmounts(p, k, 8, 400, 5000).every((a) => a < 0.01), `${id} still visible with 5 s to go`);
    assert.ok(presetAmounts(p, k, 8, 4000, 0).every((a) => a > 0.99), `${id} hidden when the caption ends`);
  }
});

test("engines built on the decoded presets animate and settle fully visible", () => {
  const style = { letterSpacing: 0, color: "#fff", highlightColor: "#ff0" };
  const mk = (ms: number, untilEnd: number) => ({ index: 1, count: 3, sinceGroup: ms, untilGroupEnd: untilEnd, sinceWord: ms, scale: 1, k: 1, exit: 0, style, isCurrent: false, revealed: true, c: 1 }) as never;
  for (const id of ["word-blink", "bottom-up-blurred"]) {
    const b = BEHAVIOR_MAP[id];
    const early = b.word!(mk(0, 5000)).style as { opacity: number }, late = b.word!(mk(3000, 5000)).style as { opacity: number };
    assert.ok(early.opacity < 0.05 && late.opacity > 0.99, id);
  }
  const g = BEHAVIOR_MAP["bounce-text"].group!({ ...(mk(0, 5000) as object), lineCount: 1 } as never).style as { opacity: number; transform: string };
  assert.equal(g.opacity, 0);
  const amp = (ms: number) => Number(String((BEHAVIOR_MAP["bounce-text"].group!({ ...(mk(ms, 5000) as object), lineCount: 1 } as never).style as { transform: string }).transform).match(/translateY\(([-\d.e]+)px/)![1]);
  assert.ok(Math.abs(amp(120)) < 30 && Math.abs(amp(2900)) < 1.5, "overshoot amplitude <= v*amp = 22.6 px and decays");
  assert.ok(Math.min(...Array.from({ length: 40 }, (_, i) => amp(120 + i * 25))) < -3, "it overshoots upwards before settling");
});

test("a caption group shorter than the preset plays time-compressed and still shows every character (rolling wave, as the preset)", () => {
  const p = AE_PRESETS["smooth-fade-in-out"];
  const groupMs = 1500;
  let best = 0;
  for (let ms = 0; ms <= groupMs; ms += 33) {
    const am = [0, 1].map((k) => presetAmounts(p, k, 8, ms, groupMs - ms));
    best = Math.max(best, Math.min(...Array.from({ length: 8 }, (_, i) => opacityOf(p, am, i))));
  }
  assert.ok(best > 0.6, `the weakest character should still reach a clearly visible level, got ${best}`);
});
