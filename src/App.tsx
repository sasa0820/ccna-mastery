import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { QuestionCard } from './components/QuestionCard';
import { SimulationCard } from './components/SimulationCard';
import { ExamMode } from './components/ExamMode';
import { SearchModal } from './components/SearchModal';
import { DataManagementModal } from './components/DataManagementModal';
import { useStudyState } from './hooks/useStudyState';
import { ALL_QUESTIONS, CATEGORIES, PART_LIST } from './data';
import { QuestionItem, MedalStatus, StudyFilter } from './types/question';
import {
  filterQuestionsPool,
  findResumeQuestionId,
  getResumeScopeKey,
  resolveActiveSolverPool,
} from './utils/studyResumeAndSync';
import { 
  Filter, 
  Play, 
  Award, 
  CheckCircle, 
  Bookmark, 
  Shuffle,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const {
    records,
    resumeState,
    stats,
    user,
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
  } = useStudyState();

  if (fatalError) {
    throw fatalError;
  }

  // Navigation tab state
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'drill' | 'simulation' | 'exam' | 'mistakes' | 'bookmarks'>('dashboard');

  // Drill active state
  const [activeFilter, setActiveFilter] = useState<StudyFilter>({
    category: 'all',
    part: 'all',
    medal: 'all',
    onlyMistakes: false,
    onlyBookmarked: false,
    questionType: 'all',
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [solverSessionIds, setSolverSessionIds] = useState<string[] | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered questions pool (live list view)
  const filteredQuestions = useMemo(() => {
    return filterQuestionsPool(ALL_QUESTIONS, activeFilter, records, currentTab);
  }, [currentTab, activeFilter, records]);

  // Active solver pool (pinned for the current question-solving session so answering
  // under 'unanswered' or 'mistakes' filters does not immediately remove the current question)
  const activeSolverQuestions = useMemo(() => {
    return resolveActiveSolverPool(ALL_QUESTIONS, filteredQuestions, solverSessionIds);
  }, [filteredQuestions, solverSessionIds]);

  // Current question index within the active solver pool
  const currentQuestionIndex = useMemo(() => {
    if (!activeQuestionId) return 0;
    const idx = activeSolverQuestions.findIndex(q => q.id === activeQuestionId);
    return idx >= 0 ? idx : 0;
  }, [activeQuestionId, activeSolverQuestions]);

  const currentQuestion = activeSolverQuestions[currentQuestionIndex] || activeSolverQuestions[0];

  // Track last visited question whenever solver view opens a question
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentTab, activeQuestionId]);

  useEffect(() => {
    if (
      activeQuestionId &&
      currentQuestion &&
      (currentTab === 'drill' ||
        currentTab === 'simulation' ||
        currentTab === 'mistakes' ||
        currentTab === 'bookmarks')
    ) {
      markQuestionVisited(currentQuestion.id, currentTab, activeFilter);
    }
  }, [activeQuestionId, currentQuestion?.id, currentTab, activeFilter, markQuestionVisited]);

  const handleRecordAnswerWithResume = (
    questionId: string,
    isCorrect: boolean,
    selectedAnswers?: string[]
  ) => {
    recordAnswer(questionId, isCorrect, selectedAnswers);
    if (
      currentTab === 'drill' ||
      currentTab === 'simulation' ||
      currentTab === 'mistakes' ||
      currentTab === 'bookmarks'
    ) {
      markQuestionAnswered(questionId, currentTab, activeFilter);
    }
  };

  // Compute global resume target for Dashboard
  const dashboardResumeInfo = useMemo(() => {
    const last = resumeState.lastGlobal;
    if (last) {
      const targetTab = last.tab;
      const targetFilter = last.filter || { category: 'all', part: 'all', medal: 'all' };
      const pool = filterQuestionsPool(ALL_QUESTIONS, targetFilter, records, targetTab);
      const nextId = findResumeQuestionId(pool, last, records);
      const q = nextId ? ALL_QUESTIONS.find(item => item.id === nextId) : undefined;
      if (q) {
        let label = '問題演習';
        if (targetTab === 'simulation') label = 'シミュレーション演習';
        else if (targetTab === 'mistakes') label = 'ミス問題復習';
        else if (targetTab === 'bookmarks') label = 'チェック問題';
        else if (targetFilter.part && targetFilter.part !== 'all') label = targetFilter.part.toUpperCase();
        else if (targetFilter.category && targetFilter.category !== 'all') label = targetFilter.category;
        return { question: q, tab: targetTab, filter: targetFilter, label };
      }
    }

    // Fallback when user has existing progress (e.g. synced from another device)
    if (stats.attemptedCount > 0) {
      const firstUnansweredId = findResumeQuestionId(ALL_QUESTIONS, undefined, records);
      const q = firstUnansweredId ? ALL_QUESTIONS.find(item => item.id === firstUnansweredId) : undefined;
      if (q) {
        return {
          question: q,
          tab: 'drill' as const,
          filter: { category: 'all', part: 'all', medal: 'all' } as StudyFilter,
          label: '未出題の問題',
        };
      }
    }

    return null;
  }, [resumeState, records, stats.attemptedCount]);

  const openSolverWithPool = (pool: QuestionItem[], targetQuestionId: string) => {
    setSolverSessionIds(pool.map(q => q.id));
    setActiveQuestionId(targetQuestionId);
  };

  const exitSolverToList = () => {
    setActiveQuestionId(null);
    setSolverSessionIds(null);
  };

  const handleResumeLastSession = () => {
    if (!dashboardResumeInfo) return;
    const pool = filterQuestionsPool(
      ALL_QUESTIONS,
      dashboardResumeInfo.filter,
      records,
      dashboardResumeInfo.tab
    );
    setActiveFilter(dashboardResumeInfo.filter);
    setCurrentTab(dashboardResumeInfo.tab);
    openSolverWithPool(pool.length > 0 ? pool : [dashboardResumeInfo.question], dashboardResumeInfo.question.id);
  };

  // Quick navigation handlers
  const handleStartDrillWithFilter = (filterParams: {
    category?: string;
    part?: string;
    medal?: MedalStatus | 'all';
    onlyMistakes?: boolean;
    onlyBookmarked?: boolean;
    isRandom?: boolean;
  }) => {
    const nextFilter: StudyFilter = {
      category: filterParams.category || 'all',
      part: filterParams.part || 'all',
      medal: filterParams.medal || 'all',
      onlyMistakes: filterParams.onlyMistakes || false,
      onlyBookmarked: filterParams.onlyBookmarked || false,
      questionType: 'all',
    };
    setActiveFilter(nextFilter);
    setCurrentTab('drill');

    const pool = filterQuestionsPool(ALL_QUESTIONS, nextFilter, records, 'drill');
    if (pool.length > 0) {
      if (filterParams.isRandom) {
        const rand = pool[Math.floor(Math.random() * pool.length)];
        openSolverWithPool(pool, rand.id);
      } else {
        const scopeKey = getResumeScopeKey('drill', nextFilter);
        const resumeId = findResumeQuestionId(pool, resumeState.byScope[scopeKey], records);
        openSolverWithPool(pool, resumeId || pool[0].id);
      }
    } else {
      exitSolverToList();
    }
  };

  const handleResumeCurrentPool = () => {
    if (filteredQuestions.length === 0) return;
    if (
      currentTab === 'drill' ||
      currentTab === 'simulation' ||
      currentTab === 'mistakes' ||
      currentTab === 'bookmarks'
    ) {
      const scopeKey = getResumeScopeKey(currentTab, activeFilter);
      const resumeId = findResumeQuestionId(filteredQuestions, resumeState.byScope[scopeKey], records);
      openSolverWithPool(filteredQuestions, resumeId || filteredQuestions[0].id);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < activeSolverQuestions.length - 1) {
      setActiveQuestionId(activeSolverQuestions[currentQuestionIndex + 1].id);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setActiveQuestionId(activeSolverQuestions[currentQuestionIndex - 1].id);
    }
  };

  const handleSelectDirectQuestion = (q: QuestionItem) => {
    const targetTab = q.type === 'simulation' ? 'simulation' : 'drill';
    const nextFilter: StudyFilter = {
      category: 'all',
      part: 'all',
      medal: 'all',
      onlyMistakes: false,
      onlyBookmarked: false,
      questionType: 'all',
    };
    setActiveFilter(nextFilter);
    setCurrentTab(targetTab);
    const pool = filterQuestionsPool(ALL_QUESTIONS, nextFilter, records, targetTab);
    openSolverWithPool(pool.length > 0 ? pool : [q], q.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Universal Sticky Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          exitSolverToList();
        }}
        stats={stats}
        user={user}
        syncStatus={syncStatus}
        onSignInGoogle={signInWithGoogle}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenDataModal={() => setIsDataModalOpen(true)}
        onDownloadQuestionsJson={downloadQuestionsJsonOnly}
        onDownloadProjectZip={downloadProjectZip}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {/* 1. Dashboard Tab */}
        {currentTab === 'dashboard' && (
          <Dashboard
            stats={stats}
            records={records}
            resumeTarget={dashboardResumeInfo}
            user={user}
            syncStatus={syncStatus}
            syncError={syncError}
            lastSyncedAt={lastSyncedAt}
            onSignInGoogle={signInWithGoogle}
            onSyncNow={syncNow}
            onResumeLast={handleResumeLastSession}
            onStartDrill={handleStartDrillWithFilter}
            onStartExam={() => setCurrentTab('exam')}
            onStartSimulation={() => {
              setCurrentTab('simulation');
              exitSolverToList();
            }}
            onOpenDataModal={() => setIsDataModalOpen(true)}
            onExportAllWithHistory={exportAllDataWithHistory}
            onDownloadQuestionsJson={downloadQuestionsJsonOnly}
          />
        )}

        {/* 2. Mock Exam Tab */}
        {currentTab === 'exam' && (
          <ExamMode
            onRecordAnswer={recordAnswer}
            onExitExam={() => setCurrentTab('dashboard')}
          />
        )}

        {/* 3. Drill / Mistakes / Bookmarks / Simulation Views */}
        {(currentTab === 'drill' || currentTab === 'simulation' || currentTab === 'mistakes' || currentTab === 'bookmarks') && (
          <div className="space-y-6">
            {/* If a question is selected for solver view */}
            {activeQuestionId && currentQuestion ? (
              currentQuestion.type === 'simulation' ? (
                <SimulationCard
                  key={currentQuestion.id}
                  question={currentQuestion}
                  record={records[currentQuestion.id]}
                  currentIndex={currentQuestionIndex}
                  totalQuestions={activeSolverQuestions.length}
                  onAnswer={handleRecordAnswerWithResume}
                  onToggleBookmark={toggleBookmark}
                  onNext={handleNextQuestion}
                  onPrev={handlePrevQuestion}
                  onBackToList={exitSolverToList}
                />
              ) : (
                <QuestionCard
                  key={currentQuestion.id}
                  question={currentQuestion}
                  record={records[currentQuestion.id]}
                  currentIndex={currentQuestionIndex}
                  totalQuestions={activeSolverQuestions.length}
                  onAnswer={handleRecordAnswerWithResume}
                  onToggleBookmark={toggleBookmark}
                  onSaveNote={saveUserNote}
                  onNext={handleNextQuestion}
                  onPrev={handlePrevQuestion}
                  onBackToList={exitSolverToList}
                />
              )
            ) : (
              /* List & Filter view */
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Filter Toolbar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                      <Filter className="w-5 h-5 text-cyan-400" />
                      <h2 className="text-lg font-bold text-white">
                        {currentTab === 'simulation' && '実機シミュレーション演習 (全75タスク)'}
                        {currentTab === 'mistakes' && `復習・ミス問題集中演習 (${filteredQuestions.length}問)`}
                        {currentTab === 'bookmarks' && `チェック・重要問題演習 (${filteredQuestions.length}問)`}
                        {currentTab === 'drill' && 'CCNAドリル問題一覧・フィルター'}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs text-slate-400">
                        対象: <strong className="text-white">{filteredQuestions.length}</strong> 問
                      </span>
                      {filteredQuestions.length > 0 && (
                        <>
                          <button
                            onClick={handleResumeCurrentPool}
                            data-testid="pool-resume-btn"
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-extrabold transition cursor-pointer shadow-sm"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>続きから再開</span>
                          </button>
                          <button
                            onClick={() => {
                              const rand = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
                              openSolverWithPool(filteredQuestions, rand.id);
                            }}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                            <span>ランダム出題</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Filter Selectors (for drill tab) */}
                  {currentTab === 'drill' && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">CCNA試験分野</label>
                        <select
                          value={activeFilter.category}
                          onChange={(e) => setActiveFilter({ ...activeFilter, category: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="all">すべての分野</option>
                          {CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">出題形式</label>
                        <select
                          value={activeFilter.questionType || 'all'}
                          onChange={(e) => setActiveFilter({ ...activeFilter, questionType: e.target.value as any })}
                          aria-label="出題形式フィルター"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="all">すべての形式 (641問)</option>
                          <option value="single_choice">単一選択 (452問)</option>
                          <option value="multiple_choice">複数選択 (52問)</option>
                          <option value="drag_and_drop">ドラッグ＆ドロップ (62問)</option>
                          <option value="simulation">実機シミュレーション (75問)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">収録PDFパート</label>
                        <select
                          value={activeFilter.part}
                          onChange={(e) => setActiveFilter({ ...activeFilter, part: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="all">すべてのパート</option>
                          {PART_LIST.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.count}問)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">メダル進捗ステータス</label>
                        <select
                          value={activeFilter.medal}
                          onChange={(e) => setActiveFilter({ ...activeFilter, medal: e.target.value as any })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="all">すべての状態</option>
                          <option value="unanswered">未出題のみ</option>
                          <option value="bronze">銅メダル (挑戦中)</option>
                          <option value="silver">銀メダル (あと1回でマスター)</option>
                          <option value="gold">金メダル (完全マスター)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Question Cards Grid */}
                {filteredQuestions.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                    <div className="p-3 bg-slate-800 rounded-full inline-block text-slate-400">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-white">該当する問題がありません</h3>
                    <p className="text-xs text-slate-400">
                      フィルター条件を変更するか、すべての問題を選択してください。
                    </p>
                    <button
                      onClick={() => setActiveFilter({ category: 'all', part: 'all', medal: 'all' })}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
                    >
                      フィルターを解除する
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuestions.map((q, idx) => {
                      const rec = records[q.id];
                      const medal = rec?.medal || 'unanswered';

                      return (
                        <div
                          key={q.id}
                          onClick={() => openSolverWithPool(filteredQuestions, q.id)}
                          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 p-4 rounded-xl shadow-md transition cursor-pointer flex flex-col justify-between group hover:shadow-cyan-500/10"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                                  {q.id}
                                </span>
                                {q.type === 'drag_and_drop' && (
                                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    D&D
                                  </span>
                                )}
                                {q.type === 'simulation' && (
                                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                    SIM
                                  </span>
                                )}
                              </div>

                              {/* Medal indicator */}
                              <div className="flex items-center space-x-1">
                                {medal === 'gold' && (
                                  <span className="text-[11px] font-bold text-yellow-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center space-x-1">
                                    <Award className="w-3 h-3 text-yellow-400" />
                                    <span>金</span>
                                  </span>
                                )}
                                {medal === 'silver' && (
                                  <span className="text-[11px] font-bold text-slate-300 bg-slate-400/10 px-2 py-0.5 rounded border border-slate-400/30 flex items-center space-x-1">
                                    <Award className="w-3 h-3 text-slate-300" />
                                    <span>銀</span>
                                  </span>
                                )}
                                {medal === 'bronze' && (
                                  <span className="text-[11px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/30 flex items-center space-x-1">
                                    <Award className="w-3 h-3 text-orange-400" />
                                    <span>銅</span>
                                  </span>
                                )}
                                {medal === 'unanswered' && (
                                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                    未
                                  </span>
                                )}

                                {rec?.isBookmarked && (
                                  <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-current ml-1" />
                                )}
                              </div>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-200 line-clamp-3 font-medium leading-relaxed group-hover:text-white transition-colors">
                              {q.questionText}
                            </p>
                          </div>

                          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[180px]">{q.category}</span>
                            <span className="text-cyan-400 font-semibold flex items-center space-x-0.5 group-hover:translate-x-0.5 transition-transform">
                              <span>演習する</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        records={records}
        onSelectQuestion={handleSelectDirectQuestion}
      />

      {/* Data Management Modal */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onExportAllWithHistory={exportAllDataWithHistory}
        onExportProgressOnly={exportProgress}
        onImport={importProgress}
        onReset={resetProgress}
        totalRecords={Object.keys(records).length}
        onDownloadQuestionsJson={downloadQuestionsJsonOnly}
        onDownloadProjectZip={downloadProjectZip}
        onGenerateSyncCode={generateSyncCode}
        onImportSyncCode={importSyncCode}
        user={user}
        syncStatus={syncStatus}
        syncError={syncError}
        lastSyncedAt={lastSyncedAt}
        onSignInGoogle={signInWithGoogle}
        onSignOutCloud={signOutCloud}
        onSyncNow={syncNow}
      />
    </div>
  );
}
