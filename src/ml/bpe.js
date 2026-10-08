/**
 * Byte-pair encoding (BPE), the way GPT-style tokenizers are built:
 * start from single characters and repeatedly glue together the most common
 * neighbouring pair. Words are pre-split so a token never spans two words
 * (a leading space stays attached to the word that follows it, like GPT-2).
 */
export function trainBPE(text, maxMerges = 400) {
  const counts = new Map();
  for (const w of pretokenize(text)) counts.set(w, (counts.get(w) || 0) + 1);
  let words = [...counts].map(([w, c]) => ({ syms: [...w], c }));
  const merges = [];
  for (let m = 0; m < maxMerges; m++) {
    const pairs = new Map();
    for (const { syms, c } of words) for (let i = 0; i + 1 < syms.length; i++) {
      const k = syms[i] + '\u0000' + syms[i + 1];
      pairs.set(k, (pairs.get(k) || 0) + c);
    }
    let best = null, bestC = 1;
    for (const [k, c] of pairs) if (c > bestC) { best = k; bestC = c; }
    if (!best) break;
    const [a, b] = best.split('\u0000');
    merges.push({ a, b, count: bestC });
    for (const w of words) w.syms = mergeOnce(w.syms, a, b);
  }
  return merges;
}

/** Split text into tokens using the first `k` merges. */
export function encode(text, merges, k = merges.length) {
  const out = [];
  for (const w of pretokenize(text)) {
    let syms = [...w];
    for (let m = 0; m < k && syms.length > 1; m++) syms = mergeOnce(syms, merges[m].a, merges[m].b);
    out.push(...syms);
  }
  return out;
}

function mergeOnce(syms, a, b) {
  const out = [];
  for (let i = 0; i < syms.length; i++) {
    if (i + 1 < syms.length && syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++; }
    else out.push(syms[i]);
  }
  return out;
}

const pretokenize = (text) => text.toLowerCase().match(/ ?[a-z']+| ?[0-9]+| ?[^\sa-z0-9']+|\s+(?!\S)|\s+/g) || [];
