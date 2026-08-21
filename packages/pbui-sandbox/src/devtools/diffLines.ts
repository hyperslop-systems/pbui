/**
 * A line diff for the versions tile, shaped for pbui's `DiffHunk`. A plain
 * LCS over lines: O(n·m) in lines, which at 64 KiB sources (a couple of
 * thousand lines) is a few milliseconds — Myers is not needed (guide §4.8).
 */
export interface DiffRow {
  op: "add" | "remove" | "context";
  text: string;
  before: number | null;
  after: number | null;
}

export interface Hunk {
  rows: DiffRow[];
  added: number;
  removed: number;
  beforeStart: number;
  afterStart: number;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(before: string, after: string): Hunk {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      rows.push({ op: "context", text: a[i]!, before: i + 1, after: j + 1 });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // Ties go to the removal, so a replaced line reads "- old / + new".
      rows.push({ op: "remove", text: a[i]!, before: i + 1, after: null });
      removed++;
      i++;
    } else {
      rows.push({ op: "add", text: b[j]!, before: null, after: j + 1 });
      added++;
      j++;
    }
  }
  return { rows, added, removed, beforeStart: 1, afterStart: 1 };
}

/** Keep only changed rows plus `context` lines around them, so an unchanged 300-line program shows its edits, not itself. */
export function trimContext(hunk: Hunk, context = 3): Hunk {
  const keep = new Array<boolean>(hunk.rows.length).fill(false);
  hunk.rows.forEach((row, index) => {
    if (row.op === "context") return;
    for (let k = Math.max(0, index - context); k <= Math.min(hunk.rows.length - 1, index + context); k++) keep[k] = true;
  });
  return { ...hunk, rows: hunk.rows.filter((_row, index) => keep[index]) };
}
