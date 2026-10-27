import React from 'react';
import { 
  Award, 
  Terminal, 
  CheckCircle2, 
  Play, 
  Zap, 
  Layers, 
  RotateCcw, 
  ShieldCheck, 
  Route, 
  Server, 
  Cpu, 
  Bot, 
  Network,
  Clock,
  Sparkles,
  Download
} from 'lucide-react';
import { CATEGORIES, PART_LIST, ALL_QUESTIONS } from '../data';
import { UserProgressRecord, MedalStatus } from '../types/question';

interface DashboardProps {
  stats: {
    total: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    unansweredCount: number;
    attemptedCount: number;
    bookmarkedCount: number;
    mistakeCount: number;
    masteredPercent: number;
    accuracyRate: number;
    totalAttemptsSum: number;
  };
  records: Record<string, UserProgressRecord>;
  onStartDrill: (filter: { category?: string; part?: string; medal?: MedalStatus | 'all'; onlyMistakes?: boolean; onlyBookmarked?: boolean; isRandom?: boolean }) => void;
  onStartExam: () => void;
  onStartSimulation: () => void;
  onExportAllWithHistory?: () => void;
  onDownloadQuestionsJson?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  records,
  onStartDrill,
  onStartExam,
  onStartSimulation,
  onExportAllWithHistory,
  onDownloadQuestionsJson,
}) => {
  // Calculate per-category medal distribution
  const categoryStats = React.useMemo(() => {
    return CATEGORIES.map(cat => {
      let catQuestions = [];
      if (cat.id === 'Simulation') {
        catQuestions = ALL_QUESTIONS.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim'));
      } else if (cat.id === 'Automation and Programmability') {
        catQuestions = ALL_QUESTIONS.filter(q => q.category.includes('Automation'));
      } else {
        catQuestions = ALL_QUESTIONS.filter(q => q.category === cat.id);
      }

      let gold = 0, silver = 0, bronze = 0, unanswered = 0, mistakes = 0;
      catQuestions.forEach(q => {
        const rec = records[q.id];
        if (!rec || rec.medal === 'unanswered' || rec.totalAttempts === 0) {
          unanswered++;
        } else {
          if (rec.medal === 'gold') gold++;
          else if (rec.medal === 'silver') silver++;
          else if (rec.medal === 'bronze') bronze++;
        }
        if (rec?.lastResult === 'incorrect') {
          mistakes++;
        }
      });

      const total = catQuestions.length;
      const goldPercent = total > 0 ? Math.round((gold / total) * 100) : 0;

      return {
        ...cat,
        total,
        gold,
        silver,
        bronze,
        unanswered,
        mistakes,
        goldPercent
      };
    });
  }, [records]);

  // Icon mapping
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Network': return <Network className="w-5 h-5 text-sky-400" />;
      case 'Server': return <Server className="w-5 h-5 text-indigo-400" />;
      case 'Route': return <Route className="w-5 h-5 text-emerald-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-purple-400" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-rose-400" />;
      case 'Bot': return <Bot className="w-5 h-5 text-teal-400" />;
      case 'Terminal': return <Terminal className="w-5 h-5 text-amber-400" />;
      default: return <Layers className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Ping-t Style Overall Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm mb-1">
                <Sparkles className="w-4 h-4" />
                <span>CCNA 200-301 徹底マスター演習</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                合格対策 Ping-t風 学習ダッシュボード
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                全8冊のPDF完全データベース化済み（全{stats.total}問・実機CLIシミュレーション75問）
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onStartDrill({ isRandom: true })}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition text-sm cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>ランダム20問演習</span>
              </button>

              <button
                onClick={onStartSimulation}
                className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition text-sm cursor-pointer"
              >
                <Terminal className="w-4 h-4" />
                <span>実機シミュレーション (75問)</span>
              </button>

              <button
                onClick={onStartExam}
                className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition text-sm cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>模擬試験</span>
              </button>

              {onDownloadQuestionsJson && (
                <button
                  onClick={onDownloadQuestionsJson}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/70 rounded-xl font-bold transition text-sm cursor-pointer shadow-md"
                  title="構文エラー・エスケープ文字修正済みの全641問実データ questions_fixed.json を即時ダウンロード"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>questions_fixed.json 直接DL</span>
                </button>
              )}

              {onExportAllWithHistory && (
                <button
                  onClick={onExportAllWithHistory}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-cyan-950/70 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/60 rounded-xl font-semibold transition text-sm cursor-pointer shadow-sm"
                  title="全641問の問題文・選択肢・正答・カテゴリ・解説・学習履歴をJSON保存"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>全問題＋履歴JSON出力</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Ping-t Stacked Progress Bar */}
          <div className="space-y-3 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                <span>全体メダル進捗状況</span>
                <span className="text-slate-400 font-normal">({stats.attemptedCount}/{stats.total}問 挑戦済)</span>
              </span>
              <span className="font-extrabold text-cyan-400">
                マスター率: {stats.masteredPercent}% (金: {stats.goldCount}問)
              </span>
            </div>

            {/* Stacked Bar */}
            <div className="h-5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              {stats.goldCount > 0 && (
                <div 
                  style={{ width: `${(stats.goldCount / stats.total) * 100}%` }} 
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 h-full transition-all duration-500 relative group"
                  title={`金メダル: ${stats.goldCount}問 (${Math.round((stats.goldCount / stats.total) * 100)}%)`}
                />
              )}
              {stats.silverCount > 0 && (
                <div 
                  style={{ width: `${(stats.silverCount / stats.total) * 100}%` }} 
                  className="bg-gradient-to-r from-slate-300 to-slate-400 h-full transition-all duration-500"
                  title={`銀メダル: ${stats.silverCount}問 (${Math.round((stats.silverCount / stats.total) * 100)}%)`}
                />
              )}
              {stats.bronzeCount > 0 && (
                <div 
                  style={{ width: `${(stats.bronzeCount / stats.total) * 100}%` }} 
                  className="bg-gradient-to-r from-orange-400 to-amber-700 h-full transition-all duration-500"
                  title={`銅メダル: ${stats.bronzeCount}問 (${Math.round((stats.bronzeCount / stats.total) * 100)}%)`}
                />
              )}
              {stats.unansweredCount > 0 && (
                <div 
                  style={{ width: `${(stats.unansweredCount / stats.total) * 100}%` }} 
                  className="bg-slate-700/60 h-full transition-all duration-500"
                  title={`未出題: ${stats.unansweredCount}問 (${Math.round((stats.unansweredCount / stats.total) * 100)}%)`}
                />
              )}
            </div>

            {/* Legend & Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/20">
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50" />
                <div className="text-xs">
                  <div className="text-slate-400">金 (完全マスター)</div>
                  <div className="text-white font-bold text-sm">{stats.goldCount}問 ({stats.masteredPercent}%)</div>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-600/30">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-300 shadow-sm shadow-slate-300/50" />
                <div className="text-xs">
                  <div className="text-slate-400">銀 (2連続正解)</div>
                  <div className="text-white font-bold text-sm">{stats.silverCount}問 ({Math.round((stats.silverCount/stats.total)*100)}%)</div>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-lg border border-orange-500/20">
                <div className="w-3.5 h-3.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/50" />
                <div className="text-xs">
                  <div className="text-slate-400">銅 (正解1回/復習)</div>
                  <div className="text-white font-bold text-sm">{stats.bronzeCount}問 ({Math.round((stats.bronzeCount/stats.total)*100)}%)</div>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />
                <div className="text-xs">
                  <div className="text-slate-400">未出題</div>
                  <div className="text-white font-bold text-sm">{stats.unansweredCount}問 ({Math.round((stats.unansweredCount/stats.total)*100)}%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Categories Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>分野別ドリル演習 (CCNA試験範囲別)</span>
          </h2>
          <span className="text-xs text-slate-400">全分野を金メダル化して一発合格を目指しましょう</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categoryStats.map(cat => (
            <div
              key={cat.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-lg flex flex-col justify-between transition group hover:shadow-cyan-500/5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/60 group-hover:scale-105 transition-transform">
                      {renderIcon(cat.iconName)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        全 {cat.total} 問
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                    金: {cat.goldPercent}%
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {cat.description}
                </p>

                {/* Progress Mini Stacked Bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    {cat.gold > 0 && (
                      <div style={{ width: `${(cat.gold / cat.total) * 100}%` }} className="bg-yellow-400 h-full" />
                    )}
                    {cat.silver > 0 && (
                      <div style={{ width: `${(cat.silver / cat.total) * 100}%` }} className="bg-slate-300 h-full" />
                    )}
                    {cat.bronze > 0 && (
                      <div style={{ width: `${(cat.bronze / cat.total) * 100}%` }} className="bg-orange-400 h-full" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>金:{cat.gold} 銀:{cat.silver} 銅:{cat.bronze}</span>
                    <span>未:{cat.unanswered}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => onStartDrill({ category: cat.id })}
                  className="flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>演習開始</span>
                </button>

                {cat.unanswered > 0 ? (
                  <button
                    onClick={() => onStartDrill({ category: cat.id, medal: 'unanswered' })}
                    className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <span>未出題のみ ({cat.unanswered})</span>
                  </button>
                ) : cat.mistakes > 0 ? (
                  <button
                    onClick={() => onStartDrill({ category: cat.id, onlyMistakes: true })}
                    className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <span>ミス復習 ({cat.mistakes})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onStartDrill({ category: cat.id, isRandom: true })}
                    className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <span>ランダム復習</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ingested PDF Part Breakdown */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>投入済みPDFファイル別演習 (全8ファイル収録)</span>
          </h2>
          <span className="text-xs text-slate-400">PDF単位での集中演習も可能です</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PART_LIST.map(part => {
            const partQuestions = ALL_QUESTIONS.filter(q => q.part.toLowerCase() === part.id.toLowerCase());
            let gold = 0;
            partQuestions.forEach(q => {
              if (records[q.id]?.medal === 'gold') gold++;
            });
            const percent = part.count > 0 ? Math.round((gold / part.count) * 100) : 0;

            return (
              <div 
                key={part.id} 
                onClick={() => onStartDrill({ part: part.id })}
                className="bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 p-3.5 rounded-xl transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {part.name}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      金: {percent}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate" title={part.source}>
                    {part.source}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                  <span>収録: <strong>{part.count}</strong> 問</span>
                  <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform text-[11px] font-medium flex items-center">
                    解く →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
