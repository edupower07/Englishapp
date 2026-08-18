/** CMの動きを作る最小限のイージング群(references/cm-recipe.md の広告プリミティブ)。 */

export const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const easeOut = (x: number) => 1 - Math.pow(1 - cl(x), 3);
export const easeIn = (x: number) => Math.pow(cl(x), 3);
export const easeInOut = (x: number) =>
  cl(x) < 0.5 ? 4 * Math.pow(cl(x), 3) : 1 - Math.pow(-2 * cl(x) + 2, 3) / 2;

/** 行き過ぎてから戻る(ロゴ・コピーの登場に) */
export const easeBack = (x: number) => {
  const c = 2.70158;
  const u = cl(x) - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

export const lerp = (a: number, b: number, x: number) => a + (b - a) * cl(x);

/** a秒に出て b秒に消える。テロップの出し入れはこれ1つで足りる */
export const pulse = (t: number, a: number, b: number, fi = 0.26, fo = 0.25) =>
  t < a || t > b ? 0 : t < a + fi ? easeOut((t - a) / fi) : t > b - fo ? easeOut((b - t) / fo) : 1;

/** シード付き乱数。毎フレーム同じ絵を決定論的に出すため Math.random は使わない */
export const makeRnd = (seed: number) => {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
};
