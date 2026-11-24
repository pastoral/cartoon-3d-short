// Unsharp mask in display space, last in the chain. The reference is sharpened (edge fits: crisp edges at sigma
// 0.2-0.4 px with overshoot to 255), so we add the same kind of edge lift. radius and amount are given at 1080x1920 and
// scale with the output height, so the 2x supersampled buffer (3840 tall) is sharpened at 2x radius before downscale.
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const frag = /* glsl */ `
uniform float amount;   // 0.6 = add 60 % of the high-pass
uniform float radius;   // px at 1080x1920
uniform float clampK;   // max change per channel (display units), keeps halos tight
vec3 enc(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 dec(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float s = resolution.y / 1920.0;
  vec2 d = texelSize * radius * s;
  vec3 c = enc(inputColor.rgb);
  vec3 b = enc(texture2D(inputBuffer, uv + vec2(d.x, 0.0)).rgb) + enc(texture2D(inputBuffer, uv - vec2(d.x, 0.0)).rgb)
         + enc(texture2D(inputBuffer, uv + vec2(0.0, d.y)).rgb) + enc(texture2D(inputBuffer, uv - vec2(0.0, d.y)).rgb);
  b = (b + 0.5 * (enc(texture2D(inputBuffer, uv + d).rgb) + enc(texture2D(inputBuffer, uv - d).rgb)
         + enc(texture2D(inputBuffer, uv + vec2(d.x, -d.y)).rgb) + enc(texture2D(inputBuffer, uv + vec2(-d.x, d.y)).rgb))) / 6.0;
  vec3 hp = clamp((c - b) * amount, -clampK, clampK);
  outputColor = vec4(dec(c + hp), inputColor.a);
}`;

export class SharpenEffect extends Effect {
  constructor({ amount = 0.6, radius = 1.0, clampK = 0.18 } = {}) {
    super("SharpenEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([["amount", new Uniform(amount)], ["radius", new Uniform(radius)], ["clampK", new Uniform(clampK)]]),
    });
  }
}
