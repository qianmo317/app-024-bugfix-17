// 重复检测：归一化后编辑距离；相同谜目且相似度 >= 阈值即提示重复（PRD §8）
import type { Riddle } from '../types';
import { normalizeText, levenshtein } from './normalize';

export const DUP_THRESHOLD = 0.85;

export interface DupMatch {
  id: string;
  no: number;
  similarity: number; // 归一化后的相似度
}

/** 单条 vs 谜库：返回相似度达阈值的候选（按相似度降序） */
export function findSimilar(
  target: Pick<Riddle, 'id' | 'surface' | 'category'>,
  list: Riddle[],
  threshold = DUP_THRESHOLD,
  limit = 5,
): DupMatch[] {
  const t = normalizeText(target.surface);
  if (!t) return [];
  const tLen = t.length;
  const allowDiff = Math.max(1, Math.ceil(tLen * (1 - threshold)));
  const out: DupMatch[] = [];
  for (const r of list) {
    if (r.id === target.id || r.category !== target.category) continue;
    const s = normalizeText(r.surface);
    if (!s) continue;
    if (Math.abs(s.length - tLen) > allowDiff) continue;
    const dist = levenshtein(t, s, allowDiff);
    if (dist > allowDiff) continue;
    const sim = 1 - dist / Math.max(s.length, tLen);
    if (sim >= threshold) out.push({ id: r.id, no: r.no, similarity: sim });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

export interface DupPair {
  aId: string;
  aNo: number;
  bId: string;
  bNo: number;
  similarity: number; // 归一化后的相似度
}

/** 全库扫描：去重后的相似对列表（每个无序对只出现一次，按相似度降序） */
export function scanDupPairs(list: Riddle[], threshold = DUP_THRESHOLD): DupPair[] {
  const norm = list.map((r) => ({ id: r.id, no: r.no, category: r.category, n: normalizeText(r.surface) }));
  const pairs: DupPair[] = [];
  for (let i = 0; i < norm.length; i++) {
    const a = norm[i];
    if (!a.n) continue;
    for (let j = i + 1; j < norm.length; j++) {
      const b = norm[j];
      if (a.category !== b.category || !b.n) continue;
      const allowDiff = Math.max(1, Math.ceil(Math.max(a.n.length, b.n.length) * (1 - threshold)));
      if (Math.abs(a.n.length - b.n.length) > allowDiff) continue;
      const dist = levenshtein(a.n, b.n, allowDiff);
      if (dist > allowDiff) continue;
      const sim = 1 - dist / Math.max(a.n.length, b.n.length);
      if (sim < threshold) continue;
      pairs.push({ aId: a.id, aNo: a.no, bId: b.id, bNo: b.no, similarity: sim });
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity);
}

/** 全库扫描：id -> 命中列表（打印页排除重复等按条查询场景用，双向登记） */
export function scanDuplicates(list: Riddle[], threshold = DUP_THRESHOLD): Map<string, DupMatch[]> {
  const map = new Map<string, DupMatch[]>();
  for (const p of scanDupPairs(list, threshold)) {
    const arr = map.get(p.aId) || [];
    arr.push({ id: p.bId, no: p.bNo, similarity: p.similarity });
    map.set(p.aId, arr);
    const arr2 = map.get(p.bId) || [];
    arr2.push({ id: p.aId, no: p.aNo, similarity: p.similarity });
    map.set(p.bId, arr2);
  }
  return map;
}
