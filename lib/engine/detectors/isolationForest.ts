import { applyTransform, chooseTransform, clamp, finite, fmt, materiality, mulberry32, robustScale } from '../stats';
import { analyzableColumns, makeFinding, type Detector } from './shared';
import type { Finding } from '../types';

type Node =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: Node; right: Node };

const EULER = 0.5772156649;

/** Average path length of an unsuccessful BST search — the iForest normaliser c(n). */
function cFactor(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

/**
 * Isolation Forest (Liu, Ting & Zhou, 2008). Anomalies are isolated in fewer random
 * splits than normal points. Catches rows where every value is individually plausible
 * but the combination is not (e.g. a normal amount booked with an unusual quantity).
 */
export const detectIsolationForest: Detector = (sheet, cfg) => {
  const cols = analyzableColumns(sheet, cfg.maxColumns);
  const d = cols.length;
  const n = sheet.rowCount;
  if (d < 2) return { findings: [], skipped: 'Needs at least 2 numeric columns.' };
  if (n < 32) return { findings: [], skipped: 'Needs at least 32 rows.' };

  // Row-major matrix; missing values imputed with the column median.
  const X = new Float64Array(n * d);
  const present = new Uint8Array(n * d);
  const centers = new Float64Array(d);
  const moneyLike = new Uint8Array(d);
  const scales = new Float64Array(d);
  for (let j = 0; j < d; j++) {
    const original = sheet.numeric[cols[j].name];
    const tf = chooseTransform(finite(original));
    moneyLike[j] = tf.log ? 1 : 0;
    const raw = applyTransform(original, tf);
    const { center, scale } = robustScale(finite(raw));
    centers[j] = center;
    scales[j] = scale > 0 ? scale : 1;
    for (let i = 0; i < n; i++) {
      const x = raw[i];
      const ok = Number.isFinite(x);
      X[i * d + j] = ok ? x : center;
      present[i * d + j] = ok ? 1 : 0;
    }
  }

  const poolList: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      if (present[i * d + j]) {
        poolList.push(i);
        break;
      }
    }
  }
  const pool = Int32Array.from(poolList);
  const m = pool.length;
  if (m < 32) return { findings: [], skipped: 'Too few rows with numeric values.' };

  const rng = mulberry32(cfg.iforest.seed);
  const psi = Math.min(cfg.iforest.sampleSize, m);
  const heightLimit = Math.ceil(Math.log2(psi));

  const build = (idx: Int32Array, depth: number): Node => {
    if (depth >= heightLimit || idx.length <= 1) return { leaf: true, size: idx.length };
    for (let attempt = 0; attempt < d; attempt++) {
      const f = Math.floor(rng() * d);
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < idx.length; k++) {
        const x = X[idx[k] * d + f];
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      if (!(hi > lo)) continue;
      const split = lo + rng() * (hi - lo);
      let leftCount = 0;
      for (let k = 0; k < idx.length; k++) if (X[idx[k] * d + f] < split) leftCount++;
      const left = new Int32Array(leftCount);
      const right = new Int32Array(idx.length - leftCount);
      let a = 0;
      let b = 0;
      for (let k = 0; k < idx.length; k++) {
        const r = idx[k];
        if (X[r * d + f] < split) left[a++] = r;
        else right[b++] = r;
      }
      return { leaf: false, feature: f, split, left: build(left, depth + 1), right: build(right, depth + 1) };
    }
    return { leaf: true, size: idx.length };
  };

  const trees: Node[] = [];
  for (let t = 0; t < cfg.iforest.trees; t++) {
    // Partial Fisher–Yates: first psi entries become a uniform sample without replacement.
    for (let k = 0; k < psi; k++) {
      const r = k + Math.floor(rng() * (m - k));
      const tmp = pool[k];
      pool[k] = pool[r];
      pool[r] = tmp;
    }
    trees.push(build(pool.slice(0, psi), 0));
  }

  const pathLength = (root: Node, row: number): number => {
    let node = root;
    let depth = 0;
    while (!node.leaf) {
      node = X[row * d + node.feature] < node.split ? node.left : node.right;
      depth++;
    }
    return depth + cFactor(node.size);
  };

  const cn = cFactor(psi);
  const threshold = cfg.iforest.threshold;
  const span = Math.max(0.05, 0.85 - threshold);
  const findings: Finding[] = [];

  for (let p = 0; p < m; p++) {
    const row = pool[p];
    let total = 0;
    for (let t = 0; t < trees.length; t++) total += pathLength(trees[t], row);
    const s = Math.pow(2, -(total / trees.length) / cn);
    if (s < threshold) continue;

    // Explainability: the column that is most extreme for this row in robust units.
    let driver = 0;
    let driverZ = -1;
    let driverLow = false;
    for (let j = 0; j < d; j++) {
      if (!present[row * d + j]) continue;
      const signed = (X[row * d + j] - centers[j]) / scales[j];
      if (Math.abs(signed) > driverZ) {
        driverZ = Math.abs(signed);
        driver = j;
        driverLow = signed < 0;
      }
    }
    const driverName = cols[driver].name;
    findings.push(
      makeFinding(sheet, row, 'iforest', {
        column: null,
        relatedColumn: driverName,
        value: null,
        score: clamp(0.5 + (0.5 * (s - threshold)) / span) * materiality(driverLow, moneyLike[driver] === 1),
        reason: `Unusual combination across ${d} columns (isolation score ${s.toFixed(2)}); most unusual: ${driverName} = ${fmt(sheet.numeric[driverName][row])}.`,
      }),
    );
  }
  return { findings };
};
