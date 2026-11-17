import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { MedalStatus, UserProgressRecord, StudyFilter } from '../types/question';
import { ALL_QUESTIONS, DATABASE_MANIFEST } from '../data';
import {
  ResumeState,
  getResumeScopeKey,
  encodeSyncCode,
  decodeSyncCode,
  mergeProgressRecords,
  mergeResumeStates,
} from '../utils/studyResumeAndSync';
import {
  batchSyncStudyStateToCloud,
  clearCloudStudyData,
  ensureUserProfile,
  fetchInitialCloudStudyData,
  subscribeCloudStudyData,
  upsertGlobalResume,
  upsertQuestionProgress,
  upsertScopeResume,
} from '../services/firestoreSyncService';

const STORAGE_KEY = 'ccna_pingt_study_records_v2';
const RESUME_STORAGE_KEY = 'ccna_pingt_resume_v1';

export type CloudSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('permission-denied')
  );
}

function formatAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'ログイン画面が閉じられました。もう一度お試しください。';
  }
  if (code === 'auth/popup-blocked') {
    return 'ポップアップがブラウザにブロックされました。ポップアップを許可して再試行してください。';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `このドメイン (${host}) は Firebase Console の「Authentication → Settings → 承認済みドメイン」に追加されていません。追加後に再度ログインしてください。`;
  }
  return err instanceof Error ? err.message : 'Googleログインに失敗しました。';
}

export function useStudyState() {
  const [records, setRecords] = useState<Record<string, UserProgressRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load study records:', e);
    }
    return {};
  });

  const [resumeState, setResumeState] = useState<ResumeState>(() => {
    try {
      const saved = localStorage.getItem(RESUME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            lastGlobal: parsed.lastGlobal,
            byScope: parsed.byScope && typeof parsed.byScope === 'object' ? parsed.byScope : {},
          };
        }
      }
    } catch (e) {
      console.error('Failed to load resume state:', e);
    }
    return { byScope: {} };
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const recordsRef = useRef(records);
  recordsRef.current = records;

  const resumeStateRef = useRef(resumeState);
  resumeStateRef.current = resumeState;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const knownProgressIdsRef = useRef<Set<string>>(new Set());
  const knownScopeIdsRef = useRef<Set<string>>(new Set());
  const hasCloudGlobalRef = useRef<boolean>(false);

  // Save to localStorage whenever records change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save study records:', e);
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumeState));
    } catch (e) {
      console.error('Failed to save resume state:', e);
    }
  }, [resumeState]);

  const handleCloudAsyncError = useCallback((err: unknown) => {
    if (isPermissionDeniedError(err)) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    setSyncStatus('error');
    setSyncError(err instanceof Error ? err.message : 'クラウド同期中にエラーが発生しました。');
  }, []);

  // Auth state listener + initial bidirectional merge + real-time onSnapshot listeners
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let cancelled = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (cancelled) return;

      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        knownProgressIdsRef.current = new Set();
        knownScopeIdsRef.current = new Set();
        hasCloudGlobalRef.current = false;
        setSyncStatus('local');
        setSyncError(null);
        return;
      }

      setSyncStatus('syncing');
      setSyncError(null);

      try {
        await ensureUserProfile(nextUser);
        if (cancelled) return;

        const initialCloud = await fetchInitialCloudStudyData(nextUser.uid);
        if (cancelled) return;

        knownProgressIdsRef.current = initialCloud.knownProgressIds;
        knownScopeIdsRef.current = initialCloud.knownScopeIds;
        hasCloudGlobalRef.current = initialCloud.hasGlobalResume;

        const mergedRecords = mergeProgressRecords(recordsRef.current, initialCloud.records);
        const mergedResume = mergeResumeStates(resumeStateRef.current, initialCloud.resumeState);

        setRecords(mergedRecords);
        setResumeState(mergedResume);

        // Push any local-only or newer local records/resume states to Firestore
        await batchSyncStudyStateToCloud(
          nextUser.uid,
          mergedRecords,
          mergedResume,
          knownProgressIdsRef.current,
          knownScopeIdsRef.current,
          hasCloudGlobalRef
        );
        if (cancelled) return;

        setLastSyncedAt(Date.now());
        setSyncStatus('synced');

        // Attach real-time Firestore listeners
        unsubscribeSnapshot = subscribeCloudStudyData(nextUser.uid, {
          onProgressChange: (cloudRecords, docIds) => {
            knownProgressIdsRef.current = docIds;
            setRecords((prev) => mergeProgressRecords(prev, cloudRecords));
            setLastSyncedAt(Date.now());
            setSyncStatus('synced');
          },
          onGlobalResumeChange: (entry, exists) => {
            hasCloudGlobalRef.current = exists;
            if (entry) {
              setResumeState((prev) =>
                mergeResumeStates(prev, { lastGlobal: entry, byScope: {} })
              );
            }
          },
          onScopesChange: (byScope, scopeIds) => {
            knownScopeIdsRef.current = scopeIds;
            setResumeState((prev) => mergeResumeStates(prev, { byScope }));
          },
          onError: (err) => {
            handleCloudAsyncError(err);
          },
        });
      } catch (err) {
        if (!cancelled) {
          handleCloudAsyncError(err);
        }
      }
    });

    return () => {
      cancelled = true;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, [handleCloudAsyncError]);

  const signInWithGoogle = useCallback(async () => {
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setSyncError(formatAuthErrorMessage(err));
    }
  }, []);

  const signOutCloud = useCallback(async () => {
    setSyncError(null);
    try {
      await signOut(auth);
      setSyncStatus('local');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'ログアウトに失敗しました。');
    }
  }, []);

  const syncNow = useCallback(async () => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const cloudData = await fetchInitialCloudStudyData(activeUser.uid);
      knownProgressIdsRef.current = cloudData.knownProgressIds;
      knownScopeIdsRef.current = cloudData.knownScopeIds;
      hasCloudGlobalRef.current = cloudData.hasGlobalResume;

      const mergedRecords = mergeProgressRecords(recordsRef.current, cloudData.records);
      const mergedResume = mergeResumeStates(resumeStateRef.current, cloudData.resumeState);

      setRecords(mergedRecords);
      setResumeState(mergedResume);

      await batchSyncStudyStateToCloud(
        activeUser.uid,
        mergedRecords,
        mergedResume,
        knownProgressIdsRef.current,
        knownScopeIdsRef.current,
        hasCloudGlobalRef
      );
      setLastSyncedAt(Date.now());
      setSyncStatus('synced');
    } catch (err) {
      handleCloudAsyncError(err);
    }
  }, [handleCloudAsyncError]);

  const markQuestionVisited = useCallback(
    (
      questionId: string,
      tab: 'drill' | 'simulation' | 'mistakes' | 'bookmarks',
      filter: StudyFilter
    ) => {
      const scopeKey = getResumeScopeKey(tab, filter);
      const now = Date.now();
      const prev = resumeStateRef.current;
      const existingScope = prev.byScope[scopeKey];
      const sameQuestionInScope = existingScope?.questionId === questionId;
      const answeredInVisit = sameQuestionInScope ? existingScope.answeredInVisit : false;

      const nextGlobal = {
        questionId,
        answeredInVisit:
          prev.lastGlobal?.questionId === questionId ? prev.lastGlobal.answeredInVisit : false,
        updatedAt: now,
        tab,
        filter: { ...filter },
      };
      const nextScope = {
        questionId,
        answeredInVisit,
        updatedAt: now,
      };

      setResumeState({
        lastGlobal: nextGlobal,
        byScope: {
          ...prev.byScope,
          [scopeKey]: nextScope,
        },
      });

      const activeUser = userRef.current;
      if (activeUser) {
        void upsertGlobalResume(activeUser.uid, nextGlobal, hasCloudGlobalRef).catch(
          handleCloudAsyncError
        );
        void upsertScopeResume(
          activeUser.uid,
          scopeKey,
          nextScope,
          knownScopeIdsRef.current
        ).catch(handleCloudAsyncError);
      }
    },
    [handleCloudAsyncError]
  );

  const markQuestionAnswered = useCallback(
    (
      questionId: string,
      tab: 'drill' | 'simulation' | 'mistakes' | 'bookmarks',
      filter: StudyFilter
    ) => {
      const scopeKey = getResumeScopeKey(tab, filter);
      const now = Date.now();
      const prev = resumeStateRef.current;

      const nextGlobal = {
        questionId,
        answeredInVisit: true,
        updatedAt: now,
        tab,
        filter: { ...filter },
      };
      const nextScope = {
        questionId,
        answeredInVisit: true,
        updatedAt: now,
      };

      setResumeState({
        lastGlobal: nextGlobal,
        byScope: {
          ...prev.byScope,
          [scopeKey]: nextScope,
        },
      });

      const activeUser = userRef.current;
      if (activeUser) {
        void upsertGlobalResume(activeUser.uid, nextGlobal, hasCloudGlobalRef).catch(
          handleCloudAsyncError
        );
        void upsertScopeResume(
          activeUser.uid,
          scopeKey,
          nextScope,
          knownScopeIdsRef.current
        ).catch(handleCloudAsyncError);
      }
    },
    [handleCloudAsyncError]
  );

  // Record an answer
  const recordAnswer = useCallback(
    (questionId: string, isCorrect: boolean, selectedAnswers?: string[]) => {
      const prev = recordsRef.current;
      const existing = prev[questionId] || {
        questionId,
        medal: 'unanswered' as MedalStatus,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        isBookmarked: false,
      };

      const totalAttempts = existing.totalAttempts + 1;
      const consecutiveCorrect = isCorrect ? existing.consecutiveCorrect + 1 : 0;
      const correctCount = existing.correctCount + (isCorrect ? 1 : 0);
      const incorrectCount = existing.incorrectCount + (isCorrect ? 0 : 1);

      let medal: MedalStatus = existing.medal;
      if (isCorrect) {
        if (consecutiveCorrect >= 3 || (existing.medal === 'silver' && consecutiveCorrect >= 2)) {
          medal = 'gold';
        } else if (
          consecutiveCorrect >= 2 ||
          (existing.medal === 'bronze' && consecutiveCorrect >= 1)
        ) {
          medal = 'silver';
        } else {
          medal = 'bronze';
        }
      } else {
        medal = 'bronze';
      }

      const nextRecord: UserProgressRecord = {
        ...existing,
        medal,
        consecutiveCorrect,
        totalAttempts,
        correctCount,
        incorrectCount,
        lastAttemptAt: Date.now(),
        lastResult: isCorrect ? 'correct' : 'incorrect',
        lastSelectedAnswers: selectedAnswers,
      };

      setRecords((current) => ({
        ...current,
        [questionId]: nextRecord,
      }));

      const activeUser = userRef.current;
      if (activeUser) {
        setSyncStatus('syncing');
        void upsertQuestionProgress(activeUser.uid, nextRecord, knownProgressIdsRef.current)
          .then(() => {
            setLastSyncedAt(Date.now());
            setSyncStatus('synced');
          })
          .catch(handleCloudAsyncError);
      }
    },
    [handleCloudAsyncError]
  );

  // Toggle bookmark
  const toggleBookmark = useCallback(
    (questionId: string) => {
      const prev = recordsRef.current;
      const existing = prev[questionId] || {
        questionId,
        medal: 'unanswered' as MedalStatus,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        isBookmarked: false,
      };

      const nextRecord: UserProgressRecord = {
        ...existing,
        isBookmarked: !existing.isBookmarked,
      };

      setRecords((current) => ({
        ...current,
        [questionId]: nextRecord,
      }));

      const activeUser = userRef.current;
      if (activeUser) {
        void upsertQuestionProgress(activeUser.uid, nextRecord, knownProgressIdsRef.current)
          .then(() => setLastSyncedAt(Date.now()))
          .catch(handleCloudAsyncError);
      }
    },
    [handleCloudAsyncError]
  );

  // Save personal note
  const saveUserNote = useCallback(
    (questionId: string, note: string) => {
      const prev = recordsRef.current;
      const existing = prev[questionId] || {
        questionId,
        medal: 'unanswered' as MedalStatus,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        isBookmarked: false,
      };

      const nextRecord: UserProgressRecord = {
        ...existing,
        userNote: note,
      };

      setRecords((current) => ({
        ...current,
        [questionId]: nextRecord,
      }));

      const activeUser = userRef.current;
      if (activeUser) {
        void upsertQuestionProgress(activeUser.uid, nextRecord, knownProgressIdsRef.current)
          .then(() => setLastSyncedAt(Date.now()))
          .catch(handleCloudAsyncError);
      }
    },
    [handleCloudAsyncError]
  );

  // Reset all progress (local + cloud)
  const resetProgress = useCallback(() => {
    setRecords({});
    setResumeState({ byScope: {} });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RESUME_STORAGE_KEY);

    const activeUser = userRef.current;
    if (activeUser) {
      setSyncStatus('syncing');
      void clearCloudStudyData(
        activeUser.uid,
        knownProgressIdsRef.current,
        knownScopeIdsRef.current,
        hasCloudGlobalRef
      )
        .then(() => {
          setLastSyncedAt(Date.now());
          setSyncStatus('synced');
        })
        .catch(handleCloudAsyncError);
    }
  }, [handleCloudAsyncError]);

  // Export progress only
  const exportProgress = useCallback(() => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `ccna_study_progress_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [records]);

  // Direct Download of pure questions_fixed.json
  const downloadQuestionsJsonOnly = useCallback(() => {
    const jsonStr = JSON.stringify(ALL_QUESTIONS, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', 'questions_fixed.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // Download complete project archive ZIP for GitHub / Vercel
  const downloadProjectZip = useCallback(() => {
    try {
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', '/ccna_app_github.zip');
      downloadAnchor.setAttribute('download', 'ccna_app_github.zip');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to download zip:', err);
    }
  }, []);

  // Export ALL Question Data merged with Learning History
  const exportAllDataWithHistory = useCallback(() => {
    const combinedData = {
      system: 'CCNA Ping-t風 学習システム',
      exportedAt: new Date().toISOString(),
      totalQuestions: ALL_QUESTIONS.length,
      manifest: DATABASE_MANIFEST,
      statistics: {
        totalAttempted: Object.keys(records).length,
        goldCount: Object.values(records).filter((r) => r.medal === 'gold').length,
        silverCount: Object.values(records).filter((r) => r.medal === 'silver').length,
        bronzeCount: Object.values(records).filter((r) => r.medal === 'bronze').length,
      },
      questions: ALL_QUESTIONS.map((q) => {
        const rec = records[q.id];
        return {
          id: q.id,
          questionNumber: q.questionNumber,
          category: q.category,
          subcategory: q.subcategory || null,
          part: q.part,
          sourceFile: q.sourceFile,
          type: q.type,
          scenarioTitle: q.scenarioTitle || null,
          questionText: q.questionText,
          options: q.options || [],
          correctAnswers: q.correctAnswers,
          diagramDescription: q.diagramDescription || null,
          commandOutputs: q.commandOutputs || null,
          solution: q.solution || null,
          verificationCommands: q.verificationCommands || [],
          explanation: q.explanation,
          keyPoints: q.keyPoints || [],
          studyHistory: {
            medal: rec?.medal || 'unanswered',
            totalAttempts: rec?.totalAttempts || 0,
            correctCount: rec?.correctCount || 0,
            incorrectCount: rec?.incorrectCount || 0,
            consecutiveCorrect: rec?.consecutiveCorrect || 0,
            accuracyRate: rec?.totalAttempts
              ? `${Math.round((rec.correctCount / rec.totalAttempts) * 100)}%`
              : '0%',
            lastResult: rec?.lastResult || 'unattempted',
            lastAttemptAt: rec?.lastAttemptAt ? new Date(rec.lastAttemptAt).toISOString() : null,
            isBookmarked: rec?.isBookmarked || false,
            userNote: rec?.userNote || '',
            lastSelectedAnswers: rec?.lastSelectedAnswers || [],
          },
        };
      }),
    };

    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute(
      'download',
      `ccna_complete_database_with_history_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  }, [records]);

  // Import progress (supports both full question export and standalone progress format)
  const importProgress = useCallback(
    (jsonStr: string): { count: number } => {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed === 'object' && parsed !== null) {
        let restoredRecords: Record<string, UserProgressRecord> = {};
        if (Array.isArray(parsed.questions)) {
          parsed.questions.forEach((q: any) => {
            if (q.id && q.studyHistory) {
              restoredRecords[q.id] = {
                questionId: q.id,
                medal: q.studyHistory.medal || 'unanswered',
                consecutiveCorrect: q.studyHistory.consecutiveCorrect || 0,
                totalAttempts: q.studyHistory.totalAttempts || 0,
                correctCount: q.studyHistory.correctCount || 0,
                incorrectCount: q.studyHistory.incorrectCount || 0,
                lastAttemptAt: q.studyHistory.lastAttemptAt
                  ? new Date(q.studyHistory.lastAttemptAt).getTime()
                  : undefined,
                lastResult:
                  q.studyHistory.lastResult === 'correct' ||
                  q.studyHistory.lastResult === 'incorrect'
                    ? q.studyHistory.lastResult
                    : undefined,
                isBookmarked: Boolean(q.studyHistory.isBookmarked),
                userNote: q.studyHistory.userNote || '',
                lastSelectedAnswers: q.studyHistory.lastSelectedAnswers || [],
              };
            }
          });
        } else {
          restoredRecords = parsed;
        }

        setRecords(restoredRecords);
        const activeUser = userRef.current;
        if (activeUser) {
          void batchSyncStudyStateToCloud(
            activeUser.uid,
            restoredRecords,
            resumeStateRef.current,
            knownProgressIdsRef.current,
            knownScopeIdsRef.current,
            hasCloudGlobalRef
          )
            .then(() => {
              setLastSyncedAt(Date.now());
              setSyncStatus('synced');
            })
            .catch(handleCloudAsyncError);
        }
        return { count: Object.keys(restoredRecords).length };
      }
      throw new Error('無効なJSON形式です。');
    },
    [handleCloudAsyncError]
  );

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = ALL_QUESTIONS.length;
    let goldCount = 0;
    let silverCount = 0;
    let bronzeCount = 0;
    let unansweredCount = 0;
    let bookmarkedCount = 0;
    let mistakeCount = 0;
    let totalAttemptsSum = 0;
    let correctAttemptsSum = 0;

    ALL_QUESTIONS.forEach((q) => {
      const rec = records[q.id];
      if (!rec || rec.medal === 'unanswered' || rec.totalAttempts === 0) {
        unansweredCount++;
      } else {
        if (rec.medal === 'gold') goldCount++;
        else if (rec.medal === 'silver') silverCount++;
        else if (rec.medal === 'bronze') bronzeCount++;

        totalAttemptsSum += rec.totalAttempts;
        correctAttemptsSum += rec.correctCount;
      }

      if (rec?.isBookmarked) {
        bookmarkedCount++;
      }

      if (rec?.lastResult === 'incorrect') {
        mistakeCount++;
      }
    });

    const masteredPercent = total > 0 ? Math.round((goldCount / total) * 100) : 0;
    const attemptedCount = total - unansweredCount;
    const accuracyRate =
      totalAttemptsSum > 0 ? Math.round((correctAttemptsSum / totalAttemptsSum) * 100) : 0;

    return {
      total,
      goldCount,
      silverCount,
      bronzeCount,
      unansweredCount,
      attemptedCount,
      bookmarkedCount,
      mistakeCount,
      masteredPercent,
      accuracyRate,
      totalAttemptsSum,
    };
  }, [records]);

  // Generate compact cross-device sync code
  const generateSyncCode = useCallback(() => {
    return encodeSyncCode(records, resumeState);
  }, [records, resumeState]);

  // Import compact cross-device sync code (merge or replace)
  const importSyncCode = useCallback(
    (code: string, mode: 'merge' | 'replace' = 'merge') => {
      const decoded = decodeSyncCode(code);
      const nextRecords =
        mode === 'merge' ? mergeProgressRecords(recordsRef.current, decoded.records) : decoded.records;
      const nextResume =
        mode === 'merge'
          ? decoded.resumeState
            ? mergeResumeStates(resumeStateRef.current, decoded.resumeState)
            : resumeStateRef.current
          : decoded.resumeState || { byScope: {} };

      setRecords(nextRecords);
      setResumeState(nextResume);

      const activeUser = userRef.current;
      if (activeUser) {
        setSyncStatus('syncing');
        void batchSyncStudyStateToCloud(
          activeUser.uid,
          nextRecords,
          nextResume,
          knownProgressIdsRef.current,
          knownScopeIdsRef.current,
          hasCloudGlobalRef
        )
          .then(() => {
            setLastSyncedAt(Date.now());
            setSyncStatus('synced');
          })
          .catch(handleCloudAsyncError);
      }

      return { importedCount: Object.keys(decoded.records).length };
    },
    [handleCloudAsyncError]
  );

  return {
    records,
    resumeState,
    stats,
    user,
    authReady,
    syncStatus,
    syncError,
    lastSyncedAt,
    fatalError,
    signInWithGoogle,
    signOutCloud,
    syncNow,
    recordAnswer,
    markQuestionVisited,
    markQuestionAnswered,
    toggleBookmark,
    saveUserNote,
    resetProgress,
    exportProgress,
    exportAllDataWithHistory,
    downloadQuestionsJsonOnly,
    downloadProjectZip,
    importProgress,
    generateSyncCode,
    importSyncCode,
  };
}
