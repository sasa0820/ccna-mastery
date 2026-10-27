import { useState, useEffect, useMemo, useCallback } from 'react';
import { MedalStatus, UserProgressRecord, QuestionItem } from '../types/question';
import { ALL_QUESTIONS, DATABASE_MANIFEST } from '../data';

const STORAGE_KEY = 'ccna_pingt_study_records_v2';

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

  // Save to localStorage whenever records change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save study records:', e);
    }
  }, [records]);

  // Record an answer
  const recordAnswer = useCallback((questionId: string, isCorrect: boolean, selectedAnswers?: string[]) => {
    setRecords(prev => {
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
      let consecutiveCorrect = isCorrect ? existing.consecutiveCorrect + 1 : 0;
      let correctCount = existing.correctCount + (isCorrect ? 1 : 0);
      let incorrectCount = existing.incorrectCount + (isCorrect ? 0 : 1);

      let medal: MedalStatus = existing.medal;
      if (isCorrect) {
        if (consecutiveCorrect >= 3 || (existing.medal === 'silver' && consecutiveCorrect >= 2)) {
          medal = 'gold';
        } else if (consecutiveCorrect >= 2 || (existing.medal === 'bronze' && consecutiveCorrect >= 1)) {
          medal = 'silver';
        } else {
          medal = 'bronze';
        }
      } else {
        // If wrong, downgrade to bronze
        medal = 'bronze';
      }

      return {
        ...prev,
        [questionId]: {
          ...existing,
          medal,
          consecutiveCorrect,
          totalAttempts,
          correctCount,
          incorrectCount,
          lastAttemptAt: Date.now(),
          lastResult: isCorrect ? 'correct' : 'incorrect',
          lastSelectedAnswers: selectedAnswers,
        }
      };
    });
  }, []);

  // Toggle bookmark
  const toggleBookmark = useCallback((questionId: string) => {
    setRecords(prev => {
      const existing = prev[questionId] || {
        questionId,
        medal: 'unanswered' as MedalStatus,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        isBookmarked: false,
      };

      return {
        ...prev,
        [questionId]: {
          ...existing,
          isBookmarked: !existing.isBookmarked,
        }
      };
    });
  }, []);

  // Save personal note
  const saveUserNote = useCallback((questionId: string, note: string) => {
    setRecords(prev => {
      const existing = prev[questionId] || {
        questionId,
        medal: 'unanswered' as MedalStatus,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        isBookmarked: false,
      };

      return {
        ...prev,
        [questionId]: {
          ...existing,
          userNote: note,
        }
      };
    });
  }, []);

  // Reset all progress
  const resetProgress = useCallback(() => {
    if (window.confirm('これまでの学習履歴（メダル、正解数、チェックなど）をすべてリセットしますか？')) {
      setRecords({});
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Export progress only
  const exportProgress = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ccna_study_progress_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [records]);

  // Direct Download of pure questions_fixed.json (641 questions, Browser in-memory Blob download)
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

  // Export ALL Question Data merged with Learning History (問題文・選択肢・正答・カテゴリ・解説・学習履歴)
  const exportAllDataWithHistory = useCallback(() => {
    const combinedData = {
      system: 'CCNA Ping-t風 学習システム',
      exportedAt: new Date().toISOString(),
      totalQuestions: ALL_QUESTIONS.length,
      manifest: DATABASE_MANIFEST,
      statistics: {
        totalAttempted: Object.keys(records).length,
        goldCount: Object.values(records).filter(r => r.medal === 'gold').length,
        silverCount: Object.values(records).filter(r => r.medal === 'silver').length,
        bronzeCount: Object.values(records).filter(r => r.medal === 'bronze').length,
      },
      questions: ALL_QUESTIONS.map(q => {
        const rec = records[q.id];
        return {
          id: q.id,
          questionNumber: q.questionNumber,
          category: q.category, // カテゴリ
          subcategory: q.subcategory || null,
          part: q.part,
          sourceFile: q.sourceFile,
          type: q.type,
          scenarioTitle: q.scenarioTitle || null,
          questionText: q.questionText, // 問題文
          options: q.options || [], // 選択肢
          correctAnswers: q.correctAnswers, // 正答
          diagramDescription: q.diagramDescription || null, // 図・トポロジの文章化
          commandOutputs: q.commandOutputs || null, // showコマンド・コンフィグ例
          solution: q.solution || null, // 模範解答コマンド
          verificationCommands: q.verificationCommands || [],
          explanation: q.explanation, // 解説
          keyPoints: q.keyPoints || [],
          // 学習履歴 (Learning History)
          studyHistory: {
            medal: rec?.medal || 'unanswered', // メダル状態 (金/銀/銅/未)
            totalAttempts: rec?.totalAttempts || 0, // 総解答回数
            correctCount: rec?.correctCount || 0, // 正解数
            incorrectCount: rec?.incorrectCount || 0, // 不正解数
            consecutiveCorrect: rec?.consecutiveCorrect || 0, // 連続正解回数
            accuracyRate: rec?.totalAttempts ? `${Math.round((rec.correctCount / rec.totalAttempts) * 100)}%` : '0%',
            lastResult: rec?.lastResult || 'unattempted', // 直近結果
            lastAttemptAt: rec?.lastAttemptAt ? new Date(rec.lastAttemptAt).toISOString() : null, // 最終演習日時
            isBookmarked: rec?.isBookmarked || false, // チェック問題フラグ
            userNote: rec?.userNote || '', // Ping-t ユーザメモ
            lastSelectedAnswers: rec?.lastSelectedAnswers || [] // 最終選択回答
          }
        };
      })
    };

    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `ccna_complete_database_with_history_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  }, [records]);

  // Import progress (supports both full question export and standalone progress format)
  const importProgress = useCallback((jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed === 'object' && parsed !== null) {
        // If it's a full export file with 'questions'
        if (Array.isArray(parsed.questions)) {
          const restoredRecords: Record<string, UserProgressRecord> = {};
          parsed.questions.forEach((q: any) => {
            if (q.id && q.studyHistory) {
              restoredRecords[q.id] = {
                questionId: q.id,
                medal: q.studyHistory.medal || 'unanswered',
                consecutiveCorrect: q.studyHistory.consecutiveCorrect || 0,
                totalAttempts: q.studyHistory.totalAttempts || 0,
                correctCount: q.studyHistory.correctCount || 0,
                incorrectCount: q.studyHistory.incorrectCount || 0,
                lastAttemptAt: q.studyHistory.lastAttemptAt ? new Date(q.studyHistory.lastAttemptAt).getTime() : undefined,
                lastResult: q.studyHistory.lastResult === 'correct' || q.studyHistory.lastResult === 'incorrect' ? q.studyHistory.lastResult : undefined,
                isBookmarked: Boolean(q.studyHistory.isBookmarked),
                userNote: q.studyHistory.userNote || '',
                lastSelectedAnswers: q.studyHistory.lastSelectedAnswers || []
              };
            }
          });
          setRecords(restoredRecords);
          alert(`全問題データベースファイルから${Object.keys(restoredRecords).length}問分の学習履歴を復元しました！`);
          return;
        }

        // Standard records mapping format
        setRecords(parsed);
        alert('学習データをインポートしました！');
      }
    } catch (e) {
      alert('データインポートに失敗しました。正しいJSONファイルを選択してください。');
    }
  }, []);

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

    ALL_QUESTIONS.forEach(q => {
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
    const accuracyRate = totalAttemptsSum > 0 ? Math.round((correctAttemptsSum / totalAttemptsSum) * 100) : 0;

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

  return {
    records,
    stats,
    recordAnswer,
    toggleBookmark,
    saveUserNote,
    resetProgress,
    exportProgress,
    exportAllDataWithHistory,
    downloadQuestionsJsonOnly,
    downloadProjectZip,
    importProgress,
  };
}
