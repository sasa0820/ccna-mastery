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
  Filter, 
  RotateCcw, 
  Play, 
  Layers, 
  Terminal, 
  Award, 
  CheckCircle, 
  Bookmark, 
  AlertCircle,
  Shuffle,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const {
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
  } = useStudyState();

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

  // Filtered questions pool
  const filteredQuestions = useMemo(() => {
    let pool = [...ALL_QUESTIONS];

    // Tab specific overrides
    if (currentTab === 'simulation') {
      pool = pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
    } else if (currentTab === 'mistakes') {
      pool = pool.filter(q => records[q.id]?.lastResult === 'incorrect');
    } else if (currentTab === 'bookmarks') {
      pool = pool.filter(q => records[q.id]?.isBookmarked);
    } else {
      // General drill filter
      if (activeFilter.category && activeFilter.category !== 'all') {
        if (activeFilter.category === 'Simulation') {
          pool = pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
        } else if (activeFilter.category === 'Automation and Programmability') {
          pool = pool.filter(q => q.category.includes('Automation'));
        } else {
          pool = pool.filter(q => q.category === activeFilter.category);
        }
      }

      if (activeFilter.part && activeFilter.part !== 'all') {
        pool = pool.filter(q => q.part.toLowerCase() === activeFilter.part!.toLowerCase());
      }

      if (activeFilter.medal && activeFilter.medal !== 'all') {
        pool = pool.filter(q => {
          const m = records[q.id]?.medal || 'unanswered';
          return m === activeFilter.medal;
        });
      }

      if (activeFilter.onlyMistakes) {
        pool = pool.filter(q => records[q.id]?.lastResult === 'incorrect');
      }

      if (activeFilter.onlyBookmarked) {
        pool = pool.filter(q => records[q.id]?.isBookmarked);
      }
    }

    return pool;
  }, [currentTab, activeFilter, records]);

  // Current question index within the active filtered pool
  const currentQuestionIndex = useMemo(() => {
    if (!activeQuestionId) return 0;
    const idx = filteredQuestions.findIndex(q => q.id === activeQuestionId);
    return idx >= 0 ? idx : 0;
  }, [activeQuestionId, filteredQuestions]);

  const currentQuestion = filteredQuestions[currentQuestionIndex] || filteredQuestions[0];

  // Quick navigation handlers
  const handleStartDrillWithFilter = (filterParams: {
    category?: string;
    part?: string;
    medal?: MedalStatus | 'all';
    onlyMistakes?: boolean;
    onlyBookmarked?: boolean;
    isRandom?: boolean;
  }) => {
    setActiveFilter({
      category: filterParams.category || 'all',
      part: filterParams.part || 'all',
      medal: filterParams.medal || 'all',
      onlyMistakes: filterParams.onlyMistakes || false,
      onlyBookmarked: filterParams.onlyBookmarked || false,
    });

    setCurrentTab('drill');

    // If random requested or target category has questions, pick target question
    setTimeout(() => {
      let pool = ALL_QUESTIONS;
      if (filterParams.category && filterParams.category !== 'all') {
        if (filterParams.category === 'Simulation') {
          pool = pool.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
        } else {
          pool = pool.filter(q => q.category === filterParams.category);
        }
      }
      if (filterParams.medal && filterParams.medal !== 'all') {
        pool = pool.filter(q => (records[q.id]?.medal || 'unanswered') === filterParams.medal);
      }
      if (filterParams.onlyMistakes) {
        pool = pool.filter(q => records[q.id]?.lastResult === 'incorrect');
      }

      if (pool.length > 0) {
        if (filterParams.isRandom) {
          const rand = pool[Math.floor(Math.random() * pool.length)];
          setActiveQuestionId(rand.id);
        } else {
          setActiveQuestionId(pool[0].id);
        }
      }
    }, 50);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setActiveQuestionId(filteredQuestions[currentQuestionIndex + 1].id);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setActiveQuestionId(filteredQuestions[currentQuestionIndex - 1].id);
    }
  };

  const handleSelectDirectQuestion = (q: QuestionItem) => {
    setActiveQuestionId(q.id);
    if (q.type === 'simulation') {
      setCurrentTab('simulation');
    } else {
      setCurrentTab('drill');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Universal Sticky Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setActiveQuestionId(null);
        }}
        stats={stats}
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
            onStartDrill={handleStartDrillWithFilter}
            onStartExam={() => setCurrentTab('exam')}
            onStartSimulation={() => {
              setCurrentTab('simulation');
              setActiveQuestionId(null);
            }}
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
                  question={currentQuestion}
                  record={records[currentQuestion.id]}
                  currentIndex={currentQuestionIndex}
                  totalQuestions={filteredQuestions.length}
                  onAnswer={recordAnswer}
                  onToggleBookmark={toggleBookmark}
                  onNext={handleNextQuestion}
                  onPrev={handlePrevQuestion}
                  onBackToList={() => setActiveQuestionId(null)}
                />
              ) : (
                <QuestionCard
                  question={currentQuestion}
                  record={records[currentQuestion.id]}
                  currentIndex={currentQuestionIndex}
                  totalQuestions={filteredQuestions.length}
                  onAnswer={recordAnswer}
                  onToggleBookmark={toggleBookmark}
                  onSaveNote={saveUserNote}
                  onNext={handleNextQuestion}
                  onPrev={handlePrevQuestion}
                  onBackToList={() => setActiveQuestionId(null)}
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

                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-slate-400">
                        対象: <strong className="text-white">{filteredQuestions.length}</strong> 問
                      </span>
                      {filteredQuestions.length > 0 && (
                        <button
                          onClick={() => {
                            const rand = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
                            setActiveQuestionId(rand.id);
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>ランダム出題</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Selectors (for drill tab) */}
                  {currentTab === 'drill' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
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
                          onClick={() => setActiveQuestionId(q.id)}
                          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 p-4 rounded-xl shadow-md transition cursor-pointer flex flex-col justify-between group hover:shadow-cyan-500/10"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                                {q.id}
                              </span>

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
      />
    </div>
  );
}
