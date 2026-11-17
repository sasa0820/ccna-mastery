import { MedalStatus, StudyFilter, UserProgressRecord } from '../types/question';
import { GlobalResumeEntry, ResumeEntry } from './studyResumeAndSync';

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const VALID_MEDALS: MedalStatus[] = ['unanswered', 'bronze', 'silver', 'gold'];
const VALID_TABS = ['drill', 'simulation', 'mistakes', 'bookmarks'] as const;
const VALID_FILTER_MEDALS = ['all', 'unanswered', 'bronze', 'silver', 'gold'] as const;
const VALID_QUESTION_TYPES = [
  'all',
  'single_choice',
  'multiple_choice',
  'drag_and_drop',
  'simulation',
] as const;

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

export function clampNonNegInt(value: unknown, max: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
  if (num < 0) return 0;
  if (num > max) return max;
  return num;
}

export function sanitizeString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(b64url: string): string {
  const normalized = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Losslessly encode any resume scope key (e.g. 'cat:IP Connectivity') into a strict
 * Firestore document ID matching ^[a-zA-Z0-9_\-]+$ within <= 128 chars.
 */
export function toFirestoreScopeId(scopeKey: string): string {
  const trimmed = sanitizeString(scopeKey, 84, 'tab:drill');
  return `s_${encodeBase64Url(trimmed)}`;
}

export function fromFirestoreScopeId(scopeId: string): string | null {
  if (!scopeId.startsWith('s_')) return null;
  try {
    return decodeBase64Url(scopeId.slice(2));
  } catch {
    return null;
  }
}

export function buildUserProfileCreatePayload<T>(
  uid: string,
  displayName: string | null | undefined,
  email: string | null | undefined,
  photoURL: string | null | undefined,
  createdAt: T,
  updatedAt: T
) {
  return {
    uid: sanitizeString(uid, 128),
    displayName: sanitizeString(displayName, 100),
    email: sanitizeString(email, 200),
    photoURL: sanitizeString(photoURL, 500),
    createdAt,
    updatedAt,
  };
}

export function buildUserProfileUpdatePayload<T>(
  displayName: string | null | undefined,
  email: string | null | undefined,
  photoURL: string | null | undefined,
  updatedAt: T
) {
  return {
    displayName: sanitizeString(displayName, 100),
    email: sanitizeString(email, 200),
    photoURL: sanitizeString(photoURL, 500),
    updatedAt,
  };
}

function normalizeQuestionProgressFields(record: UserProgressRecord) {
  const medal: MedalStatus = VALID_MEDALS.includes(record.medal) ? record.medal : 'unanswered';
  const lastResult: 'none' | 'correct' | 'incorrect' =
    record.lastResult === 'correct' || record.lastResult === 'incorrect'
      ? record.lastResult
      : 'none';

  const lastSelectedAnswers = Array.isArray(record.lastSelectedAnswers)
    ? record.lastSelectedAnswers
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 20)
        .map((item) => sanitizeString(item, 500))
    : [];

  return {
    medal,
    consecutiveCorrect: clampNonNegInt(record.consecutiveCorrect, 100000),
    totalAttempts: clampNonNegInt(record.totalAttempts, 1000000),
    correctCount: clampNonNegInt(record.correctCount, 1000000),
    incorrectCount: clampNonNegInt(record.incorrectCount, 1000000),
    lastAttemptAt: clampNonNegInt(record.lastAttemptAt, Number.MAX_SAFE_INTEGER),
    lastResult,
    isBookmarked: Boolean(record.isBookmarked),
    userNote: sanitizeString(record.userNote, 2000),
    lastSelectedAnswers,
  };
}

export function buildQuestionProgressCreatePayload<T>(
  uid: string,
  record: UserProgressRecord,
  createdAt: T,
  updatedAt: T
) {
  return {
    uid: sanitizeString(uid, 128),
    questionId: sanitizeString(record.questionId, 128),
    ...normalizeQuestionProgressFields(record),
    createdAt,
    updatedAt,
  };
}

export function buildQuestionProgressUpdatePayload<T>(
  record: UserProgressRecord,
  updatedAt: T
) {
  return {
    ...normalizeQuestionProgressFields(record),
    updatedAt,
  };
}

export function parseQuestionProgressDoc(data: Record<string, unknown>): UserProgressRecord | null {
  if (typeof data.questionId !== 'string' || !isValidFirestoreId(data.questionId)) {
    return null;
  }
  const medal = VALID_MEDALS.includes(data.medal as MedalStatus)
    ? (data.medal as MedalStatus)
    : 'unanswered';
  const lastAttemptAt = clampNonNegInt(data.lastAttemptAt, Number.MAX_SAFE_INTEGER);
  const lastResult =
    data.lastResult === 'correct' || data.lastResult === 'incorrect' ? data.lastResult : undefined;
  const userNote = sanitizeString(data.userNote, 2000);
  const lastSelectedAnswers = Array.isArray(data.lastSelectedAnswers)
    ? data.lastSelectedAnswers.filter((x): x is string => typeof x === 'string').slice(0, 20)
    : undefined;

  return {
    questionId: data.questionId,
    medal,
    consecutiveCorrect: clampNonNegInt(data.consecutiveCorrect, 100000),
    totalAttempts: clampNonNegInt(data.totalAttempts, 1000000),
    correctCount: clampNonNegInt(data.correctCount, 1000000),
    incorrectCount: clampNonNegInt(data.incorrectCount, 1000000),
    lastAttemptAt: lastAttemptAt > 0 ? lastAttemptAt : undefined,
    lastResult,
    isBookmarked: Boolean(data.isBookmarked),
    userNote: userNote.length > 0 ? userNote : undefined,
    lastSelectedAnswers:
      lastSelectedAnswers && lastSelectedAnswers.length > 0 ? lastSelectedAnswers : undefined,
  };
}

function normalizeGlobalResumeFields(entry: GlobalResumeEntry) {
  const tab = (VALID_TABS as readonly string[]).includes(entry.tab) ? entry.tab : 'drill';
  const filter = entry.filter || {};
  const filterCategory = sanitizeString(filter.category, 100, 'all') || 'all';
  const filterPart = sanitizeString(filter.part, 64, 'all') || 'all';
  const filterMedal = (VALID_FILTER_MEDALS as readonly string[]).includes(filter.medal || 'all')
    ? (filter.medal as (typeof VALID_FILTER_MEDALS)[number])
    : 'all';
  const filterQuestionType = (VALID_QUESTION_TYPES as readonly string[]).includes(
    filter.questionType || 'all'
  )
    ? (filter.questionType as (typeof VALID_QUESTION_TYPES)[number])
    : 'all';

  return {
    questionId: sanitizeString(entry.questionId, 128),
    answeredInVisit: Boolean(entry.answeredInVisit),
    tab,
    filterCategory,
    filterPart,
    filterMedal,
    filterQuestionType,
    filterOnlyMistakes: Boolean(filter.onlyMistakes),
    filterOnlyBookmarked: Boolean(filter.onlyBookmarked),
    clientUpdatedAt: clampNonNegInt(entry.updatedAt, Number.MAX_SAFE_INTEGER),
  };
}

export function buildGlobalResumeCreatePayload<T>(
  uid: string,
  entry: GlobalResumeEntry,
  createdAt: T,
  updatedAt: T
) {
  return {
    uid: sanitizeString(uid, 128),
    ...normalizeGlobalResumeFields(entry),
    createdAt,
    updatedAt,
  };
}

export function buildGlobalResumeUpdatePayload<T>(entry: GlobalResumeEntry, updatedAt: T) {
  return {
    ...normalizeGlobalResumeFields(entry),
    updatedAt,
  };
}

export function parseGlobalResumeDoc(data: Record<string, unknown>): GlobalResumeEntry | null {
  if (typeof data.questionId !== 'string' || !isValidFirestoreId(data.questionId)) {
    return null;
  }
  const tab = (VALID_TABS as readonly string[]).includes(String(data.tab))
    ? (data.tab as GlobalResumeEntry['tab'])
    : 'drill';
  const filter: StudyFilter = {
    category: sanitizeString(data.filterCategory, 100, 'all') || 'all',
    part: sanitizeString(data.filterPart, 64, 'all') || 'all',
    medal: (VALID_FILTER_MEDALS as readonly string[]).includes(String(data.filterMedal))
      ? (data.filterMedal as StudyFilter['medal'])
      : 'all',
    questionType: (VALID_QUESTION_TYPES as readonly string[]).includes(
      String(data.filterQuestionType)
    )
      ? (data.filterQuestionType as StudyFilter['questionType'])
      : 'all',
    onlyMistakes: Boolean(data.filterOnlyMistakes),
    onlyBookmarked: Boolean(data.filterOnlyBookmarked),
  };

  return {
    questionId: data.questionId,
    answeredInVisit: Boolean(data.answeredInVisit),
    updatedAt: clampNonNegInt(data.clientUpdatedAt, Number.MAX_SAFE_INTEGER),
    tab,
    filter,
  };
}

export function buildScopeResumeCreatePayload<T>(
  uid: string,
  scopeKey: string,
  entry: ResumeEntry,
  createdAt: T,
  updatedAt: T
) {
  return {
    uid: sanitizeString(uid, 128),
    scopeId: toFirestoreScopeId(scopeKey),
    questionId: sanitizeString(entry.questionId, 128),
    answeredInVisit: Boolean(entry.answeredInVisit),
    clientUpdatedAt: clampNonNegInt(entry.updatedAt, Number.MAX_SAFE_INTEGER),
    createdAt,
    updatedAt,
  };
}

export function buildScopeResumeUpdatePayload<T>(entry: ResumeEntry, updatedAt: T) {
  return {
    questionId: sanitizeString(entry.questionId, 128),
    answeredInVisit: Boolean(entry.answeredInVisit),
    clientUpdatedAt: clampNonNegInt(entry.updatedAt, Number.MAX_SAFE_INTEGER),
    updatedAt,
  };
}

export function parseScopeResumeDoc(
  data: Record<string, unknown>
): { scopeKey: string; entry: ResumeEntry } | null {
  if (
    typeof data.scopeId !== 'string' ||
    typeof data.questionId !== 'string' ||
    !isValidFirestoreId(data.scopeId) ||
    !isValidFirestoreId(data.questionId)
  ) {
    return null;
  }
  const scopeKey = fromFirestoreScopeId(data.scopeId);
  if (!scopeKey) return null;

  return {
    scopeKey,
    entry: {
      questionId: data.questionId,
      answeredInVisit: Boolean(data.answeredInVisit),
      updatedAt: clampNonNegInt(data.clientUpdatedAt, Number.MAX_SAFE_INTEGER),
    },
  };
}
