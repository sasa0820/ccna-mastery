import { QuestionItem } from '../types/question';

export interface DragDropDraggableItem {
  id: string;
  label: string;
}

export interface DragDropTargetSlot {
  id: string;
  title: string;
  maxItems: number; // 1 for 1-to-1 matching, >1 for category classification
  expectedItemIds: string[];
}

export interface ParsedDragDropQuestion {
  mode: 'category' | 'matching' | 'multi_select_dnd';
  items: DragDropDraggableItem[];
  targets: DragDropTargetSlot[];
}

/**
 * Normalizes text for loose comparison when matching option text against answer substrings.
 */
function normalizeText(s: string): string {
  return s
    .replace(/[\s\u3000]+/g, '')
    .replace(/[。、，,．.：:（）()「」『』［］\[\]・\-ー]/g, '')
    .toLowerCase();
}

/**
 * Deterministic hash-based shuffle so draggable options are not always in exact answer order
 * when generated from empty options, while remaining 100% deterministic per question.id.
 */
function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const result = [...arr];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Parses any of the 62 drag_and_drop questions in questions_fixed.json into a clean,
 * interactive Drag-and-Drop structure (draggable items + target buckets/slots).
 */
export function parseDragDropQuestion(question: QuestionItem): ParsedDragDropQuestion {
  const rawOptions = question.options || [];
  const rawAnswers = question.correctAnswers || [];

  // Special Case 1: Answer strings have no ':' or '：' or '→' (e.g., part12_q104: select 4 items into target zone)
  const hasSeparator = rawAnswers.some(a => /[:：→]/.test(a));
  if (!hasSeparator && rawOptions.length > 0) {
    const items: DragDropDraggableItem[] = rawOptions.map(o => ({
      id: o.id,
      label: o.text,
    }));
    const expectedIds: string[] = [];
    for (const ans of rawAnswers) {
      const normAns = normalizeText(ans);
      const matched = items.find(
        it => normalizeText(it.label) === normAns || it.id.toLowerCase() === ans.trim().toLowerCase()
      );
      if (matched && !expectedIds.includes(matched.id)) {
        expectedIds.push(matched.id);
      }
    }
    return {
      mode: 'multi_select_dnd',
      items,
      targets: [
        {
          id: 'target_selected',
          title: `選択エリア (${expectedIds.length}つドロップ)`,
          maxItems: expectedIds.length || rawAnswers.length,
          expectedItemIds: expectedIds,
        },
      ],
    };
  }

  // Split each correctAnswer by first separator (→, ：, or : followed by space/non-hex)
  const parsedPairs: { left: string; right: string }[] = rawAnswers.map(ans => {
    const arrowIdx = ans.indexOf('→');
    if (arrowIdx !== -1) {
      return {
        left: ans.slice(0, arrowIdx).trim(),
        right: ans.slice(arrowIdx + 1).trim(),
      };
    }
    const fullColonIdx = ans.indexOf('：');
    if (fullColonIdx !== -1) {
      return {
        left: ans.slice(0, fullColonIdx).trim(),
        right: ans.slice(fullColonIdx + 1).trim(),
      };
    }
    // Find ASCII colon ':' that is not inside IPv6 address (like 2001:DB8::)
    const match = ans.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      return {
        left: match[1].trim(),
        right: match[2].trim(),
      };
    }
    const colonIdx = ans.indexOf(':');
    if (colonIdx !== -1) {
      return {
        left: ans.slice(0, colonIdx).trim(),
        right: ans.slice(colonIdx + 1).trim(),
      };
    }
    return { left: ans.trim(), right: ans.trim() };
  });

  // Case 2: Options is empty (17 questions in part14-16). Extract items & targets from parsedPairs!
  if (rawOptions.length === 0) {
    // Determine if right side is comma-separated multiple items per category
    const hasMultiRight = parsedPairs.some(p => p.right.includes(', ') || p.right.includes('、'));
    if (hasMultiRight && parsedPairs.length <= 3) {
      const allItems: DragDropDraggableItem[] = [];
      const targets: DragDropTargetSlot[] = [];
      let itemCounter = 1;

      parsedPairs.forEach((p, idx) => {
        // Split by ', ' or '、' carefully
        const parts = p.right
          .split(/,\s+|、/)
          .map(s => s.trim())
          .filter(Boolean);
        const expectedIds: string[] = [];
        for (const pt of parts) {
          const id = `item_${itemCounter++}`;
          allItems.push({ id, label: pt });
          expectedIds.push(id);
        }
        targets.push({
          id: `target_${idx + 1}`,
          title: p.left,
          maxItems: expectedIds.length,
          expectedItemIds: expectedIds,
        });
      });

      return {
        mode: 'category',
        items: deterministicShuffle(allItems, question.id),
        targets,
      };
    } else {
      // 1-to-1 matching with empty options
      const allItems: DragDropDraggableItem[] = [];
      const targets: DragDropTargetSlot[] = [];
      parsedPairs.forEach((p, idx) => {
        const itemId = `item_${idx + 1}`;
        // Put the shorter or technical term as the draggable badge, or right side as draggable
        allItems.push({ id: itemId, label: p.right });
        targets.push({
          id: `target_${idx + 1}`,
          title: p.left,
          maxItems: 1,
          expectedItemIds: [itemId],
        });
      });

      return {
        mode: 'matching',
        items: deterministicShuffle(allItems, question.id),
        targets,
      };
    }
  }

  // Case 3: Options is populated (45 questions)
  // Subcase 3A: Direct ID reference like "1,2 → eBGP" (part11_q19) or "R1:a", "R2:b,d" (part11_q59)
  const optionIds = new Set(rawOptions.map(o => o.id.trim().toLowerCase()));
  const firstLeftTokens = parsedPairs[0]?.left.split(/[,、\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) || [];
  const firstRightTokens = parsedPairs[0]?.right.split(/[,、\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) || [];

  if (firstLeftTokens.length > 0 && firstLeftTokens.every(t => optionIds.has(t))) {
    // e.g. part11_q19: "1,2 → eBGP" where options are 1..5 and targets are eBGP, EIGRP, スタティックルート
    const items: DragDropDraggableItem[] = rawOptions.map(o => ({ id: o.id, label: o.text }));
    const targets: DragDropTargetSlot[] = parsedPairs.map((p, idx) => {
      const ids = p.left
        .split(/[,、\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(tok => rawOptions.find(o => o.id.toLowerCase() === tok.toLowerCase())?.id || tok);
      return {
        id: `target_${idx + 1}`,
        title: p.right,
        maxItems: ids.length,
        expectedItemIds: ids,
      };
    });
    return { mode: 'category', items, targets };
  }

  if (firstRightTokens.length > 0 && firstRightTokens.every(t => optionIds.has(t))) {
    // e.g. part11_q59: "R1:a", "R2:b,d", "R3:e" where options are a..f
    const items: DragDropDraggableItem[] = rawOptions.map(o => ({ id: o.id, label: `${o.id.toUpperCase()}: ${o.text}` }));
    const targets: DragDropTargetSlot[] = parsedPairs.map((p, idx) => {
      const ids = p.right
        .split(/[,、\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(tok => rawOptions.find(o => o.id.toLowerCase() === tok.toLowerCase())?.id || tok);
      return {
        id: `target_${idx + 1}`,
        title: p.left,
        maxItems: ids.length,
        expectedItemIds: ids,
      };
    });
    return { mode: 'category', items, targets };
  }

  // Subcase 3B: Check whether options match the `left` side of parsedPairs (1-to-1 matching where options are descriptions)
  // e.g. part11_q03: options[0]="YAMLで記述された自動化タスクの集合", ans[0]="YAMLで記述された自動化タスクの集合：playbook"
  const leftMatchesOptionCount = parsedPairs.filter(p => {
    const normLeft = normalizeText(p.left.replace(/^[①②③④⑤⑥⑦⑧1-9]\s*/, ''));
    return rawOptions.some(o => {
      const normOpt = normalizeText(o.text);
      return normOpt === normLeft || normLeft.includes(normOpt) || normOpt.includes(normLeft);
    });
  }).length;

  const rightMatchesOptionCount = parsedPairs.filter(p => {
    const normRight = normalizeText(p.right);
    return rawOptions.some(o => {
      const normOpt = normalizeText(o.text);
      return normOpt === normRight || normRight.includes(normOpt);
    });
  }).length;

  // If parsedPairs.length < rawOptions.length (e.g. 2 or 3 categories vs 4-6 options), it's Category Classification!
  if (parsedPairs.length < rawOptions.length || rightMatchesOptionCount > leftMatchesOptionCount) {
    const items: DragDropDraggableItem[] = rawOptions.map(o => ({ id: o.id, label: o.text }));
    const assignedOptionIds = new Set<string>();

    const targets: DragDropTargetSlot[] = parsedPairs.map((p, idx) => {
      const normRight = normalizeText(p.right);
      const matchedIds: string[] = [];

      for (const opt of rawOptions) {
        if (assignedOptionIds.has(opt.id)) continue;
        const normOpt = normalizeText(opt.text);
        if (normOpt && normRight.includes(normOpt)) {
          matchedIds.push(opt.id);
          assignedOptionIds.add(opt.id);
        }
      }

      return {
        id: `target_${idx + 1}`,
        title: p.left,
        maxItems: Math.max(1, matchedIds.length),
        expectedItemIds: matchedIds,
      };
    });

    return {
      mode: parsedPairs.length === rawOptions.length ? 'matching' : 'category',
      items: deterministicShuffle(items, question.id),
      targets,
    };
  }

  // Otherwise (left side matches rawOptions, e.g. part11_q03, part11_q11, part11_q34, part11_q44):
  // Here rawOptions are the prompt descriptions (left side), and the right side of each answer is the target term!
  // Let's make the right-side terms the draggable badges, and the rawOptions the target slots!
  const allItems: DragDropDraggableItem[] = [];
  const targets: DragDropTargetSlot[] = [];

  parsedPairs.forEach((p, idx) => {
    const itemId = `term_${idx + 1}`;
    allItems.push({
      id: itemId,
      label: p.right,
    });
    targets.push({
      id: `target_${idx + 1}`,
      title: p.left,
      maxItems: 1,
      expectedItemIds: [itemId],
    });
  });

  return {
    mode: 'matching',
    items: deterministicShuffle(allItems, question.id),
    targets,
  };
}

/**
 * Evaluates user's slot assignments against expectedItemIds.
 * assignments: Record<targetId, itemId[]>
 */
export function evaluateDragDropAssignments(
  parsed: ParsedDragDropQuestion,
  assignments: Record<string, string[]>
): {
  isAllCorrect: boolean;
  targetResults: Record<string, boolean>;
  correctCount: number;
  totalTargets: number;
} {
  const targetResults: Record<string, boolean> = {};
  let correctCount = 0;

  for (const target of parsed.targets) {
    const userItems = [...(assignments[target.id] || [])].sort();
    const expectedItems = [...target.expectedItemIds].sort();
    const isTargetCorrect =
      userItems.length === expectedItems.length &&
      userItems.every((val, idx) => val === expectedItems[idx]);

    targetResults[target.id] = isTargetCorrect;
    if (isTargetCorrect) {
      correctCount++;
    }
  }

  return {
    isAllCorrect: correctCount === parsed.targets.length && parsed.targets.length > 0,
    targetResults,
    correctCount,
    totalTargets: parsed.targets.length,
  };
}
