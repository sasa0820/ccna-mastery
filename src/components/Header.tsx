import React from 'react';
import { 
  Award, 
  Search, 
  Bookmark, 
  AlertCircle, 
  Terminal, 
  Clock, 
  Layers, 
  BookOpen, 
  HardDrive,
  Download,
  Package,
  Cloud,
  CloudOff,
  Loader2,
  LogIn
} from 'lucide-react';
import { MedalStatus } from '../types/question';
import { CloudSyncStatus } from '../hooks/useStudyState';

interface HeaderProps {
  currentTab: 'dashboard' | 'drill' | 'simulation' | 'exam' | 'mistakes' | 'bookmarks';
  onSelectTab: (tab: 'dashboard' | 'drill' | 'simulation' | 'exam' | 'mistakes' | 'bookmarks') => void;
  stats: {
    total: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    unansweredCount: number;
    bookmarkedCount: number;
    mistakeCount: number;
    masteredPercent: number;
  };
  user?: { displayName: string | null; email: string | null; photoURL: string | null } | null;
  syncStatus?: CloudSyncStatus;
  onSignInGoogle?: () => void;
  onOpenSearch: () => void;
  onOpenDataModal: () => void;
  onDownloadQuestionsJson?: () => void;
  onDownloadProjectZip?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  stats,
  user,
  syncStatus = 'local',
  onSignInGoogle,
  onOpenSearch,
  onOpenDataModal,
  onDownloadQuestionsJson,
  onDownloadProjectZip
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
      {/* Top Banner with Logo and Medal Counters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-extrabold text-base sm:text-xl tracking-tight text-white">CCNA</span>
                <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 whitespace-nowrap">Ping-t風</span>
              </div>
              <p className="hidden lg:block text-xs text-slate-400 whitespace-nowrap">CCNA合格演習システム (全{stats.total}問・実機CLI収録)</p>
            </div>
          </div>

          {/* Ping-t Style Medal Badges */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60 shadow-inner shrink-0">
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 whitespace-nowrap" title="金メダル (完全マスター)">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>金:</span>
              <strong className="text-white font-bold">{stats.goldCount}</strong>
            </div>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-slate-300 bg-slate-400/10 border border-slate-400/30 whitespace-nowrap" title="銀メダル (2連続正解)">
              <Award className="w-3.5 h-3.5 text-slate-300" />
              <span>銀:</span>
              <strong className="text-white font-bold">{stats.silverCount}</strong>
            </div>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/30 whitespace-nowrap" title="銅メダル (正解1回)">
              <Award className="w-3.5 h-3.5 text-orange-400" />
              <span>銅:</span>
              <strong className="text-white font-bold">{stats.bronzeCount}</strong>
            </div>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-slate-400 bg-slate-700/30 border border-slate-600/30 whitespace-nowrap" title="未出題">
              <span>未:</span>
              <strong className="text-slate-300 font-bold">{stats.unansweredCount}</strong>
            </div>

            <div className="h-4 w-px bg-slate-700 mx-1"></div>

            <div className="text-xs text-cyan-400 font-semibold px-1 whitespace-nowrap">
              習得率: <span className="text-white font-bold">{stats.masteredPercent}%</span>
            </div>
          </div>

          {/* Action buttons (Cloud Sync, Search, Download & Settings) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {user ? (
              <button
                onClick={onOpenDataModal}
                data-testid="header-cloud-status-btn"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  syncStatus === 'error'
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 hover:bg-rose-900'
                    : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200 hover:bg-emerald-900'
                }`}
                title={`クラウド自動同期 (${user.email || 'ログイン中'})`}
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                ) : syncStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">
                  {syncStatus === 'syncing' ? '同期中...' : syncStatus === 'error' ? '同期エラー' : 'クラウド同期済'}
                </span>
                <span className="sm:hidden">同期済</span>
              </button>
            ) : (
              onSignInGoogle && (
                <button
                  onClick={onSignInGoogle}
                  data-testid="header-sync-login-btn"
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/50 transition text-xs font-bold shadow-sm cursor-pointer whitespace-nowrap"
                  title="GoogleアカウントでログインしてPC・スマホ間で学習履歴を自動同期"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">同期ログイン</span>
                  <span className="sm:hidden">同期</span>
                </button>
              )
            )}

            {onDownloadProjectZip && (
              <button
                onClick={onDownloadProjectZip}
                className="hidden sm:flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-500/70 transition text-xs font-bold shadow-md shadow-indigo-900/30 cursor-pointer whitespace-nowrap"
                title="GitHub + Vercel 公開可能な完全プロジェクト一式 (ZIP) を即時ダウンロード"
              >
                <Package className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="hidden xl:inline">ZIP 一括保存</span>
                <span className="xl:hidden">ZIP</span>
              </button>
            )}

            {onDownloadQuestionsJson && (
              <button
                onClick={onDownloadQuestionsJson}
                className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-500/60 transition text-xs font-semibold shadow-sm cursor-pointer whitespace-nowrap"
                title="構文エラー・エスケープ文字修正済みの全641問実データ questions_fixed.json を即時ダウンロード"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>questions_fixed.json</span>
              </button>
            )}

            <button
              onClick={onOpenSearch}
              aria-label="全問題を検索"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
              title="全問題を検索 (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">問題検索</span>
            </button>

            <button
              onClick={onOpenDataModal}
              aria-label="データバックアップ・同期設定"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
              title="データバックアップ・復元・引き継ぎ"
            >
              <HardDrive className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex space-x-1 py-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ホーム</span>
          </button>

          <button
            onClick={() => onSelectTab('drill')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'drill'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>問題演習 (ドリル)</span>
          </button>

          <button
            onClick={() => onSelectTab('simulation')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'simulation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>シミュレーション演習 (75問)</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-emerald-500/20 text-emerald-300 rounded font-bold">CLI</span>
          </button>

          <button
            onClick={() => onSelectTab('exam')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'exam'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>模擬試験</span>
          </button>

          <button
            onClick={() => onSelectTab('mistakes')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'mistakes'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>ミス問題 ({stats.mistakeCount})</span>
          </button>

          <button
            onClick={() => onSelectTab('bookmarks')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'bookmarks'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span>チェック問題 ({stats.bookmarkedCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
};
