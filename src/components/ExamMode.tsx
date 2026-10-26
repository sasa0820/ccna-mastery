import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Flag, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Award, 
  BarChart2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { QuestionItem, UserProgressRecord } from '../types/question';
import { ALL_QUESTIONS, CATEGORIES } from '../data';

interface ExamModeProps {
  onRecordAnswer: (questionId: string, isCorrect: boolean, selectedAnswers: string[]) => void;
  onExitExam: () => void;
}

export const ExamMode: React.FC<ExamModeProps> = ({
  onRecordAnswer,
  onExitExam
}) => {
  const [examStarted, setExamStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Active exam state
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45 * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Start exam handler
  const handleStartExam = () => {
    let pool = [...ALL_QUESTIONS];
    if (selectedCategory !== 'all') {
      pool = pool.filter(q => q.category === selectedCategory);
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    setExamQuestions(selected);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions({});
    setSecondsRemaining(durationMinutes * 60);
    setIsSubmitted(false);
    setExamStarted(true);
  };

  // Timer countdown
  useEffect(() => {
    if (!examStarted || isSubmitted) return;

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, isSubmitted]);

  // Format timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optionId: string) => {
    if (isSubmitted) return;
    const currentQ = examQuestions[currentIndex];
    if (!currentQ) return;

    const isMultiple = currentQ.correctAnswers.length > 1;
    const currentSelected = userAnswers[currentQ.id] || [];

    if (isMultiple) {
      if (currentSelected.includes(optionId)) {
        setUserAnswers({
          ...userAnswers,
          [currentQ.id]: currentSelected.filter(id => id !== optionId)
        });
      } else {
        setUserAnswers({
          ...userAnswers,
          [currentQ.id]: [...currentSelected, optionId]
        });
      }
    } else {
      setUserAnswers({
        ...userAnswers,
        [currentQ.id]: [optionId]
      });
    }
  };

  const toggleFlag = (qId: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const handleSubmitExam = () => {
    if (!window.confirm('模擬試験を終了し、採点しますか？')) return;

    setIsSubmitted(true);

    // Record results to persistent study stats
    examQuestions.forEach(q => {
      const selected = userAnswers[q.id] || [];
      const sortedS = [...selected].sort();
      const sortedC = [...q.correctAnswers].sort();
      const isCorrect = 
        sortedS.length === sortedC.length &&
        sortedS.every((val, idx) => val.trim().toUpperCase() === sortedC[idx].trim().toUpperCase());

      onRecordAnswer(q.id, isCorrect, selected);
    });
  };

  // Results calculation
  const examResult = useMemo(() => {
    if (!isSubmitted) return null;

    let correctCount = 0;
    const categoryScores: Record<string, { total: number; correct: number }> = {};

    examQuestions.forEach(q => {
      const selected = userAnswers[q.id] || [];
      const sortedS = [...selected].sort();
      const sortedC = [...q.correctAnswers].sort();
      const isCorrect = 
        sortedS.length === sortedC.length &&
        sortedS.every((val, idx) => val.trim().toUpperCase() === sortedC[idx].trim().toUpperCase());

      if (isCorrect) correctCount++;

      const cat = q.category || 'Other';
      if (!categoryScores[cat]) {
        categoryScores[cat] = { total: 0, correct: 0 };
      }
      categoryScores[cat].total++;
      if (isCorrect) categoryScores[cat].correct++;
    });

    const percent = Math.round((correctCount / examQuestions.length) * 100);
    // CCNA score conversion: scaled 300 - 1000, passing score is 825
    const scaledScore = Math.round(300 + (percent * 7));
    const passed = scaledScore >= 825;

    return {
      correctCount,
      totalCount: examQuestions.length,
      percent,
      scaledScore,
      passed,
      categoryScores
    };
  }, [isSubmitted, examQuestions, userAnswers]);

  // Current Question
  const currentQ = examQuestions[currentIndex];

  if (!examStarted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                CCNA 本番模擬試験モード
              </h2>
              <p className="text-slate-400 text-sm">
                本番の出題形式・制限時間・採点ロジック（1000点満点・合格ライン825点）を忠実に再現
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                出題問題数 & 制限時間
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setQuestionCount(30); setDurationMinutes(45); }}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    questionCount === 30 
                      ? 'bg-blue-600 text-white border-blue-500 font-bold' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">30問 (Mini)</div>
                  <div className="text-xs text-slate-300/80">制限時間 45分</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setQuestionCount(60); setDurationMinutes(90); }}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    questionCount === 60 
                      ? 'bg-blue-600 text-white border-blue-500 font-bold' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">60問 (標準)</div>
                  <div className="text-xs text-slate-300/80">制限時間 90分</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setQuestionCount(100); setDurationMinutes(120); }}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    questionCount === 100 
                      ? 'bg-blue-600 text-white border-blue-500 font-bold' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">100問 (本番級)</div>
                  <div className="text-xs text-slate-300/80">制限時間 120分</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                出題対象範囲
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">全範囲（全641問からランダム総合出題）</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.count}問)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="font-bold text-slate-300 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>本番模擬試験のルール</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li>試験中は答えや解説は表示されません。</li>
              <li>「見直しフラグ」をつけておくと、後から見直しが可能です。</li>
              <li>時間切れになると自動的に採点画面に遷移します。</li>
              <li>試験結果は学習履歴・メダルへ自動反映されます。</li>
            </ul>
          </div>

          <button
            onClick={handleStartExam}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer text-base"
          >
            模擬試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // RESULT SCREEN AFTER SUBMISSION
  if (isSubmitted && examResult) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Pass / Fail Banner */}
        <div className={`p-8 rounded-2xl border text-center space-y-4 shadow-xl ${
          examResult.passed 
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100 shadow-emerald-900/20' 
            : 'bg-rose-950/40 border-rose-500/50 text-rose-100 shadow-rose-900/20'
        }`}>
          <div className="inline-flex p-4 rounded-full bg-slate-900/80 mb-2">
            {examResult.passed ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            ) : (
              <XCircle className="w-16 h-16 text-rose-400" />
            )}
          </div>

          <h2 className="text-3xl font-extrabold">
            {examResult.passed ? '🎉 合格 (PASS)！ おめでとうございます！' : '不合格 (FAIL) - もう一息です！'}
          </h2>

          <div className="flex justify-center items-center space-x-8 py-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">得点換算 (1000点満点)</div>
              <div className="text-3xl font-black text-white">{examResult.scaledScore} / 1000</div>
              <div className="text-xs text-slate-400">合格ライン: 825点</div>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">正答率</div>
              <div className="text-3xl font-black text-white">{examResult.percent}%</div>
              <div className="text-xs text-slate-400">{examResult.correctCount} / {examResult.totalCount} 問正解</div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            <span>分野別得点率レポート</span>
          </h3>

          <div className="space-y-3">
            {Object.entries(examResult.categoryScores).map(([cat, score]) => {
              const catPercent = Math.round((score.correct / score.total) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">{cat}</span>
                    <span className="text-white font-bold">{catPercent}% ({score.correct}/{score.total})</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${catPercent}%` }} 
                      className={`h-full ${catPercent >= 82 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Review List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">全問振り返り・解説確認</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {examQuestions.map((q, idx) => {
              const userAns = userAnswers[q.id] || [];
              const isCorrect = [...userAns].sort().join(',') === [...q.correctAnswers].sort().join(',');

              return (
                <div 
                  key={q.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                    isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-400">問 {idx + 1}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{q.category}</span>
                      <span className="text-xs font-mono text-slate-500">[{q.id}]</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 line-clamp-2">{q.questionText}</p>
                    <div className="text-xs text-slate-400 pt-1">
                      あなたの解答: <strong className="text-white">{userAns.join(', ') || '未解答'}</strong> | 
                      正解: <strong className="text-emerald-400">{q.correctAnswers.join(', ')}</strong>
                    </div>
                  </div>

                  <div>
                    {isCorrect ? (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded">
                        正解
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded">
                        不正解
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action button */}
        <div className="flex justify-center">
          <button
            onClick={() => setExamStarted(false)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer text-sm"
          >
            模擬試験トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE EXAM TEST VIEW
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Test Header with Timer */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-xs font-bold text-slate-300">
            問題 {currentIndex + 1} / {examQuestions.length}
          </div>
          <button
            onClick={() => toggleFlag(currentQ.id)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
              flaggedQuestions[currentQ.id]
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Flag className={`w-3.5 h-3.5 ${flaggedQuestions[currentQ.id] ? 'fill-current' : ''}`} />
            <span>見直しフラグ</span>
          </button>
        </div>

        {/* Timer display */}
        <div className="flex items-center space-x-2 bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-800">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-mono font-bold text-sm text-white">
            残り時間: {formatTime(secondsRemaining)}
          </span>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmitExam}
          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm shadow-rose-600/20"
        >
          試験終了・採点
        </button>
      </div>

      {/* Question Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold">
            {currentQ.category}
          </span>
          {currentQ.correctAnswers.length > 1 && (
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-bold">
              複数選択 ({currentQ.correctAnswers.length}つ選択)
            </span>
          )}
        </div>

        <div className="text-slate-100 text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap">
          {currentQ.questionText}
        </div>

        {currentQ.commandOutputs && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto shadow-inner">
            {currentQ.commandOutputs}
          </div>
        )}

        {currentQ.diagramDescription && (
          <div className="p-3 bg-sky-950/20 border border-sky-900/40 rounded-xl text-xs text-slate-300 whitespace-pre-wrap">
            <span className="font-bold text-sky-400 block mb-1">【トポロジ図解】</span>
            {currentQ.diagramDescription}
          </div>
        )}

        {/* Options */}
        <div className="space-y-2.5 pt-2">
          {currentQ.options?.map((opt) => {
            const isSelected = (userAnswers[currentQ.id] || []).includes(opt.id);

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectOption(opt.id)}
                className={`flex items-start p-3.5 sm:p-4 rounded-xl border transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-blue-900/50 border-blue-500 text-white shadow-md shadow-blue-900/30'
                    : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                }`}
              >
                <div className={`w-6 h-6 mr-3 rounded-md flex items-center justify-center font-bold text-xs border ${
                  isSelected ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}>
                  {opt.id}
                </div>
                <div className="flex-1 text-sm sm:text-base leading-relaxed">
                  {opt.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Navigation Matrix */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>問題一覧ナビゲーター</span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>解答済</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>見直しフラグ</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {examQuestions.map((q, idx) => {
            const isAns = (userAnswers[q.id] || []).length > 0;
            const isFlag = flaggedQuestions[q.id];
            const isCur = idx === currentIndex;

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded text-xs font-mono font-bold transition relative cursor-pointer ${
                  isCur 
                    ? 'ring-2 ring-cyan-400 text-white font-black' 
                    : ''
                } ${
                  isFlag 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' 
                    : isAns 
                      ? 'bg-blue-600/70 text-white' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prev / Next controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center space-x-1 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>前の問題</span>
        </button>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(examQuestions.length - 1, prev + 1))}
          disabled={currentIndex >= examQuestions.length - 1}
          className="flex items-center space-x-1 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          <span>次の問題</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
