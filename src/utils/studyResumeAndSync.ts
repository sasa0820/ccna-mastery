import { MedalStatus, QuestionItem, StudyFilter, UserProgressRecord } from '../types/question';

export interface ResumeEntry {
  questionId: string;
  answeredInVisit: boolean;
  updatedAt: number;
}

export interface GlobalResumeEntry extends ResumeEntry {
  tab: 'drill' | 'simulation' | 'mistakes' | 'bookmarks';
  filter?: StudyFilter;
}

export interface ResumeState {
  lastGlobal?: GlobalResumeEntry;
  byScope: Record<string, ResumeEntry>;
}

const MEDAL_TO_NUM: Record<MedalStatus, number> = {
  unanswered: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

const NUM_TO_MEDAL: MedalStatus[] = ['unanswered', 'bronze', 'silver', 'gold'];

/**
 * Pure filter function shared across Dashboard quick-start and App list view
 */
export function filterQuestionsPool(
  questions: QuestionItem[],
  filter: StudyFilter,
  records: Record<string, UserProgressRecord>,
  tab: 'dashboard' | 'drill' | 'simulation' | 'exam' | 'mistakes' | 'bookmarks' = 'drill'
): QuestionItem[] {
  let pool = [...questions];

  if (tab === 'simulation') {
    return pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
  }
  if (tab === 'mistakes') {
    return pool.filter(q => records[q.id]?.lastResult === 'incorrect');
  }
  if (tab === 'bookmarks') {
    return pool.filter(q => records[q.id]?.isBookmarked);
  }

  if (filter.category && filter.category !== 'all') {
    if (filter.category === 'Simulation') {
      pool = pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
    } else if (filter.category === 'Automation and Programmability') {
      pool = pool.filter(q => q.category.includes('Automation'));
    } else {
      pool = pool.filter(q => q.category === filter.category);
    }
  }

  if (filter.part && filter.part !== 'all') {
    const targetPart = filter.part.toLowerCase();
    if (targetPart === 'simulation') {
      pool = pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
    } else {
      pool = pool.filter(q => q.part.toLowerCase() === targetPart);
    }
  }

  if (filter.medal && filter.medal !== 'all') {
    pool = pool.filter(q => (records[q.id]?.medal || 'unanswered') === filter.medal);
  }

  if (filter.onlyMistakes) {
    pool = pool.filter(q => records[q.id]?.lastResult === 'incorrect');
  }

  if (filter.onlyBookmarked) {
    pool = pool.filter(q => records[q.id]?.isBookmarked);
  }

  if (filter.questionType && filter.questionType !== 'all') {
    pool = pool.filter(q => q.type === filter.questionType);
  }

  return pool;
}

/**
 * Derive a stable scope key for remembering resume position per filter/tab
 */
export function getResumeScopeKey(
  tab: 'drill' | 'simulation' | 'mistakes' | 'bookmarks',
  filter: StudyFilter
): string {
  if (tab === 'simulation') return 'tab:simulation';
  if (tab === 'mistakes') return 'tab:mistakes';
  if (tab === 'bookmarks') return 'tab:bookmarks';

  if (filter.part && filter.part !== 'all') {
    return `part:${filter.part.toLowerCase()}`;
  }
  if (filter.category && filter.category !== 'all') {
    return `cat:${filter.category}`;
  }
  if (filter.questionType && filter.questionType !== 'all') {
    return `type:${filter.questionType}`;
  }
  return 'tab:drill';
}

/**
 * Determine which question ID to resume from inside `pool`.
 * - If a saved resume entry exists in `pool`:
 *   - If the user left without submitting (`answeredInVisit === false`), resume on that exact question.
 *   - If the user already submitted (`answeredInVisit === true`), advance to the next question in `pool`
 *     (or the next unanswered question if at the end).
 * - Otherwise (e.g. imported data or first time in this scope), start from the first unanswered question,
 *   then first non-gold question, then `pool[0]`.
 */
export function findResumeQuestionId(
  pool: QuestionItem[],
  resumeEntry: ResumeEntry | undefined,
  records: Record<string, UserProgressRecord>
): string | null {
  if (pool.length === 0) return null;

  if (resumeEntry) {
    const idx = pool.findIndex(q => q.id === resumeEntry.questionId);
    if (idx !== -1) {
      if (!resumeEntry.answeredInVisit) {
        return pool[idx].id;
      }
      if (idx + 1 < pool.length) {
        return pool[idx + 1].id;
      }
      // Reached end of pool: try first unanswered, else wrap to first
      const firstUnanswered = pool.find(q => !records[q.id] || records[q.id].totalAttempts === 0);
      return firstUnanswered ? firstUnanswered.id : pool[0].id;
    }
  }

  const firstUnanswered = pool.find(q => !records[q.id] || records[q.id].totalAttempts === 0);
  if (firstUnanswered) return firstUnanswered.id;

  const firstNonGold = pool.find(q => records[q.id]?.medal !== 'gold');
  if (firstNonGold) return firstNonGold.id;

  return pool[0].id;
}

/**
 * Keep the active solver question pool pinned during an active question-solving session
 * so answering a question under status-based filters (e.g. `medal === 'unanswered'`,
 * `mistakes`, or `bookmarks`) does not immediately evict the current question and hide
 * its answer & explanation before the user clicks "Next".
 */
export function resolveActiveSolverPool(
  allQuestions: QuestionItem[],
  filteredQuestions: QuestionItem[],
  solverSessionIds: string[] | null
): QuestionItem[] {
  if (!solverSessionIds || solverSessionIds.length === 0) {
    return filteredQuestions;
  }

  const byId = new Map<string, QuestionItem>();
  for (const q of allQuestions) {
    byId.set(q.id, q);
  }

  const pinned: QuestionItem[] = [];
  for (const id of solverSessionIds) {
    const q = byId.get(id);
    if (q) pinned.push(q);
  }

  return pinned.length > 0 ? pinned : filteredQuestions;
}

// --- Compact Cross-Device Sync Code (UTF-8 safe Base64) ---

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

type CompactRecordTuple = [
  number, // 0: medal index
  number, // 1: consecutiveCorrect
  number, // 2: totalAttempts
  number, // 3: correctCount
  number, // 4: incorrectCount
  number, // 5: lastAttemptAt (0 if none)
  number, // 6: lastResult (0=none, 1=correct, 2=incorrect)
  number, // 7: isBookmarked (0/1)
  string? // 8: userNote (optional)
];

interface CompactPayload {
  v: 1;
  r: Record<string, CompactRecordTuple>;
  s?: ResumeState;
}

export function encodeSyncCode(
  records: Record<string, UserProgressRecord>,
  resumeState?: ResumeState
): string {
  const compactRecords: Record<string, CompactRecordTuple> = {};

  for (const [qId, rec] of Object.entries(records)) {
    const hasActivity =
      rec.totalAttempts > 0 ||
      rec.isBookmarked ||
      Boolean(rec.userNote && rec.userNote.trim().length > 0);
    if (!hasActivity) continue;

    const tuple: CompactRecordTuple = [
      MEDAL_TO_NUM[rec.medal] ?? 0,
      rec.consecutiveCorrect || 0,
      rec.totalAttempts || 0,
      rec.correctCount || 0,
      rec.incorrectCount || 0,
      rec.lastAttemptAt || 0,
      rec.lastResult === 'correct' ? 1 : rec.lastResult === 'incorrect' ? 2 : 0,
      rec.isBookmarked ? 1 : 0,
    ];
    if (rec.userNote && rec.userNote.trim().length > 0) {
      tuple.push(rec.userNote);
    }
    compactRecords[qId] = tuple;
  }

  const payload: CompactPayload = {
    v: 1,
    r: compactRecords,
    ...(resumeState ? { s: resumeState } : {}),
  };

  return 'CCNA1:' + utf8ToBase64(JSON.stringify(payload));
}

export interface DecodedSyncData {
  records: Record<string, UserProgressRecord>;
  resumeState?: ResumeState;
}

export function decodeSyncCode(rawInput: string): DecodedSyncData {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('同期コードが空です');
  }

  if (trimmed.startsWith('CCNA1:')) {
    const b64 = trimmed.slice('CCNA1:'.length).replace(/\s+/g, '');
    const json = base64ToUtf8(b64);
    const parsed = JSON.parse(json) as CompactPayload;
    if (!parsed || parsed.v !== 1 || typeof parsed.r !== 'object' || parsed.r === null) {
      throw new Error('無効な同期コード形式です');
    }

    const records: Record<string, UserProgressRecord> = {};
    for (const [qId, tuple] of Object.entries(parsed.r)) {
      if (!Array.isArray(tuple) || tuple.length < 8) continue;
      records[qId] = {
        questionId: qId,
        medal: NUM_TO_MEDAL[tuple[0]] || 'unanswered',
        consecutiveCorrect: Number(tuple[1]) || 0,
        totalAttempts: Number(tuple[2]) || 0,
        correctCount: Number(tuple[3]) || 0,
        incorrectCount: Number(tuple[4]) || 0,
        lastAttemptAt: tuple[5] ? Number(tuple[5]) : undefined,
        lastResult: tuple[6] === 1 ? 'correct' : tuple[6] === 2 ? 'incorrect' : undefined,
        isBookmarked: Boolean(tuple[7]),
        userNote: typeof tuple[8] === 'string' ? tuple[8] : undefined,
      };
    }

    return {
      records,
      resumeState: parsed.s,
    };
  }

  // Fallback: also allow raw JSON records export
  const parsedJson = JSON.parse(trimmed);
  if (typeof parsedJson === 'object' && parsedJson !== null) {
    return { records: parsedJson as Record<string, UserProgressRecord> };
  }

  throw new Error('認識できないデータ形式です');
}

/**
 * Merge local and incoming progress records without losing either device's progress.
 */
export function mergeProgressRecords(
  local: Record<string, UserProgressRecord>,
  incoming: Record<string, UserProgressRecord>
): Record<string, UserProgressRecord> {
  const merged: Record<string, UserProgressRecord> = { ...local };

  for (const [qId, inc] of Object.entries(incoming)) {
    const loc = merged[qId];
    if (!loc) {
      merged[qId] = inc;
      continue;
    }

    // Prefer whichever has more attempts, or newer timestamp when tied
    const incTime = inc.lastAttemptAt || 0;
    const locTime = loc.lastAttemptAt || 0;
    const preferIncoming =
      inc.totalAttempts > loc.totalAttempts ||
      (inc.totalAttempts === loc.totalAttempts && incTime >= locTime);

    const base = preferIncoming ? inc : loc;
    const other = preferIncoming ? loc : inc;

    merged[qId] = {
      ...base,
      isBookmarked: Boolean(loc.isBookmarked || inc.isBookmarked),
      userNote: base.userNote && base.userNote.trim() ? base.userNote : other.userNote,
    };
  }

  return merged;
}

export function mergeResumeStates(
  local: ResumeState,
  incoming?: ResumeState
): ResumeState {
  if (!incoming) return local;

  const byScope: Record<string, ResumeEntry> = { ...local.byScope };
  for (const [scope, incEntry] of Object.entries(incoming.byScope || {})) {
    const locEntry = byScope[scope];
    if (!locEntry || incEntry.updatedAt > locEntry.updatedAt) {
      byScope[scope] = incEntry;
    }
  }

  let lastGlobal = local.lastGlobal;
  if (
    incoming.lastGlobal &&
    (!lastGlobal || incoming.lastGlobal.updatedAt > lastGlobal.updatedAt)
  ) {
    lastGlobal = incoming.lastGlobal;
  }

  return { lastGlobal, byScope };
}
