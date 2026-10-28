#version 460 core
// Orvane connection sphere: an analytically shaded glass orb.
//
// Every pixel reconstructs the sphere normal from its position, so the
// lighting is real 3D shading rather than a painted gradient:
//   * Fresnel rim light, brighter at grazing angles like real glass
//   * Blinn-Phong specular, sharp core + broad sheen
//   * Caustic: light refracted through the orb, focused on the far side
//   * Horizon band reflected from an implied environment
//   * Internal "energy" nebula sampled through a refraction-warped domain
//   * Outer glow falloff for the illuminated states
// The light direction follows device tilt (uTilt), so highlights slide
// across the surface as the phone moves.
//
// Output is premultiplied alpha, as Flutter expects.

#include <flutter/runtime_effect.glsl>

precision highp float;

uniform vec2 uSize;
uniform vec2 uCenter;     // sphere centre in px
uniform float uRadius;    // sphere radius in px
uniform float uTime;      // seconds, wrapped
uniform vec2 uTilt;       // -1..1, x right / y down
uniform vec3 uTint;       // primary hue
uniform vec3 uAccent;     // flash hue (success)
uniform float uAccentMix; // 0..1
uniform float uEnergy;    // 0..1 illumination
uniform float uPress;     // 0..1 finger pressure

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = FlutterFragCoord().xy;
  vec2 p = (frag - uCenter) / uRadius;
  p.y = -p.y;
  float r2 = dot(p, p);
  float r = sqrt(r2);
  float px = 1.0 / uRadius;

  vec3 tint = mix(uTint, uAccent, uAccentMix);
  float energy = clamp(uEnergy, 0.0, 1.0);

  // Outer glow, visible outside the silhouette.
  float glowAmt = exp(-max(r - 1.0, 0.0) * 6.0) * (0.10 + 0.50 * energy);
  glowAmt *= smoothstep(1.9, 1.0, r);
  vec4 outside = vec4(tint * glowAmt, glowAmt);

  if (r > 1.0 + 2.0 * px) {
    fragColor = outside;
    return;
  }

  vec3 n = vec3(p, sqrt(max(1.0 - r2, 0.0)));
  vec3 V = vec3(0.0, 0.0, 1.0);
  // Light sits top-left and swings against the tilt.
  vec3 L = normalize(vec3(-0.55 - uTilt.x * 0.55, 0.62 + uTilt.y * 0.45, 0.85));
  float ndl = max(dot(n, L), 0.0);
  float fres = pow(1.0 - n.z, 2.4);

  // Glass body: near-black core, colour gathering towards the rim, and a
  // faint sky reflection on the upper hemisphere.
  vec3 deep = vec3(0.014, 0.026, 0.06);
  vec3 col = mix(deep, tint * 0.26, fres * 0.9);
  col += vec3(0.30, 0.42, 0.78) * 0.09 * smoothstep(-0.3, 1.0, n.y) * (0.4 + 0.6 * fres);
  col += tint * 0.05 * ndl;

  // Internal energy, seen through refraction: the domain is warped by the
  // surface normal so the nebula appears to sit inside the volume.
  vec3 rd = refract(-V, n, 0.69);
  vec2 q = p * 1.25 + rd.xy * 0.6;
  float t = uTime;
  float ca = cos(t * 0.11), sa = sin(t * 0.11);
  q = mat2(ca, -sa, sa, ca) * q;
  float neb = fbm(q * 1.8 + vec2(t * 0.04, -t * 0.03));
  float neb2 = fbm(q * 3.1 - vec2(t * 0.05, t * 0.02));
  float depthFade = 0.30 + 0.70 * n.z;
  // Lifted floor keeps the gaps between clouds from reading as dark smudges.
  float cloud = 0.30 + 0.70 * smoothstep(0.32, 1.05, neb * 0.72 + neb2 * 0.38);
  col += tint * cloud * (0.025 + 0.60 * energy) * depthFade;
  // Thin luminous filaments drifting through the cloud.
  float fil = pow(1.0 - abs(sin((q.x * 1.6 + neb * 2.6 + t * 0.07) * 3.14159)), 10.0);
  col += mix(tint, vec3(0.85, 0.92, 1.0), 0.4) * fil * cloud * (0.01 + 0.30 * energy) * depthFade;

  // Bright core glow.
  float core = exp(-r2 * 3.4);
  col += mix(tint, vec3(1.0), 0.25) * core * (0.03 + 0.38 * energy);

  // Caustic: light focused on the side opposite the light source.
  vec2 cp = -L.xy * 0.52;
  float caus = exp(-dot(p - cp, p - cp) * 7.0);
  col += mix(tint, vec3(1.0), 0.35) * caus * (0.07 + 0.30 * energy);

  // Refraction band: real glass orbs show a darker ring just inside a
  // bright rim, where the view ray bends through the thickest glass.
  float band = smoothstep(0.78, 0.92, r) * (1.0 - smoothstep(0.92, 0.985, r));
  col *= 1.0 - band * 0.38;

  // Fresnel rim with a whisper of dispersion around the edge.
  float ang = atan(p.y, p.x);
  vec3 rimHue = mix(vec3(0.55, 0.76, 1.0), vec3(0.66, 0.56, 1.0), 0.5 + 0.5 * sin(ang * 1.5 + t * 0.15));
  // The rim is lit unevenly - strongest facing the light, softer opposite -
  // which is what makes it read as a sphere rather than a ring on a disc.
  float facing = dot(normalize(p + 1e-4), normalize(L.xy));
  float rimLight = 0.50 + 0.50 * smoothstep(-0.9, 0.9, facing);
  col += mix(tint, rimHue, 0.45) * fres * rimLight * (0.40 + 0.70 * energy);

  // Reflected environment: a soft horizon line.
  vec3 R = reflect(-V, n);
  float horizon = smoothstep(-0.06, 0.03, R.y) * smoothstep(0.26, 0.05, R.y);
  col += vec3(0.62, 0.76, 1.0) * horizon * fres * 0.28;

  // Softbox highlight: a shaped studio reflection rather than a point
  // sun. It slides with the light (and so with tilt).
  vec2 hp = vec2(L.x * 0.62, L.y * 0.62);
  vec2 hd = p - hp;
  float ha = -0.65;
  hd = mat2(cos(ha), -sin(ha), sin(ha), cos(ha)) * hd;
  float soft = smoothstep(0.30, 0.0, length(hd * vec2(1.0, 2.3)));
  col += vec3(0.82, 0.90, 1.0) * soft * soft * 0.42;
  float hot = smoothstep(0.085, 0.01, length(hd * vec2(1.0, 2.0)));
  col += vec3(1.0) * hot * 0.75;

  // Secondary window reflection, lower right, smaller and dimmer.
  vec2 wp = vec2(-L.x * 0.55, -L.y * 0.62);
  float win = smoothstep(0.14, 0.0, length((p - wp) * vec2(1.0, 2.2)));
  col += vec3(0.70, 0.82, 1.0) * win * 0.09;

  // Thin bright edge.
  float rimLine = smoothstep(1.0 - 4.0 * px, 1.0 - 1.0 * px, r);
  col += rimHue * rimLine * (0.25 + 0.35 * energy);

  // Form shading: the side turned away from the light falls off.
  col *= 0.72 + 0.38 * smoothstep(-0.6, 0.8, dot(n, L));

  col *= 1.0 + uPress * 0.18;

  // Gentle tone-map so highlights roll off instead of clipping.
  col = col / (1.0 + col * 0.28);

  float inside = smoothstep(1.0 + 1.2 * px, 1.0 - 1.2 * px, r);
  fragColor = vec4(col, 1.0) * inside + outside * (1.0 - inside);
}
