/* =========================================================================
   Model Configuration
   ========================================================================= */

export const MODEL = {
  vocab: 50257,
  hidden: 768,
  layers: 12,
  heads: 12,
  maxSeq: 1024
};

export function paramCount(m) {
  const emb = m.vocab * m.hidden + m.maxSeq * m.hidden;
  const perLayer = 12 * m.hidden * m.hidden + 13 * m.hidden;
  return emb + m.layers * perLayer + 2 * m.hidden;
}

export const PARAMS = paramCount(MODEL);