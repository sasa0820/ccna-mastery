import React, { useRef, useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  X,
  Database,
  Sparkles,
  Package,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Cloud,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DATABASE_MANIFEST } from '../data';
import { CloudSyncStatus } from '../hooks/useStudyState';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportAllWithHistory: () => void;
  onExportProgressOnly: () => void;
  onImport: (jsonStr: string) => { count: number };
  onReset: () => void;
  totalRecords: number;
  onDownloadQuestionsJson?: () => void;
  onDownloadProjectZip?: () => void;
  onGenerateSyncCode?: () => string;
  onImportSyncCode?: (code: string, mode: 'merge' | 'replace') => { importedCount: number };
  user?: { displayName: string | null; email: string | null; photoURL: string | null } | null;
  syncStatus?: CloudSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: number | null;
  onSignInGoogle?: () => void;
  onSignOutCloud?: () => void;
  onSyncNow?: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  onExportAllWithHistory,
  onExportProgressOnly,
  onImport,
  onReset,
  totalRecords,
  onDownloadQuestionsJson,
  onDownloadProjectZip,
  onGenerateSyncCode,
  onImportSyncCode,
  user,
  syncStatus = 'local',
  syncError,
  lastSyncedAt,
  onSignInGoogle,
  onSignOutCloud,
  onSyncNow,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copiedSync, setCopiedSync] = useState(false);
  const [pasteCode, setPasteCode] = useState('');
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const res = onImport(content);
          setSyncFeedback({
            type: 'success',
            text: `JSONファイルから${res.count}問分の学習履歴を復元しました！`,
          });
        } catch (err) {
          setSyncFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'データインポートに失敗しました。',
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCopySyncCode = async () => {
    if (!onGenerateSyncCode) return;
    const code = onGenerateSyncCode();
    setGeneratedCode(code);
    setSyncFeedback(null);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 3000);
    } catch {
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 3000);
    }
  };

  const handleApplySyncCode = () => {
    if (!onImportSyncCode) return;
    setSyncFeedback(null);
    try {
      const res = onImportSyncCode(pasteCode, syncMode);
      setPasteCode('');
      setSyncFeedback({
        type: 'success',
        text: `${res.importedCount}問分の学習履歴と「続きの位置」を復元・同期しました！`,
      });
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : '同期コードの読み込みに失敗しました。',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">PC⇔スマホ 同期 ＆ データ管理</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="モーダルを閉じる"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloud Auto Sync Section (Firebase Auth + Firestore) */}
        <div className="bg-gradient-to-br from-emerald-950/50 via-slate-950 to-cyan-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Googleアカウント自動クラウド同期</span>
            </div>
            {user ? (
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                {syncStatus === 'syncing' ? '同期中...' : '自動同期ON'}
              </span>
            ) : (
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold">
                未ログイン
              </span>
            )}
          </div>

          {user ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center space-x-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-8 h-8 rounded-full border border-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {user.displayName || 'Googleアカウント'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>
                {lastSyncedAt && (
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    最終同期: {new Date(lastSyncedAt).toLocaleTimeString('ja-JP')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onSyncNow && (
                  <button
                    type="button"
                    onClick={onSyncNow}
                    disabled={syncStatus === 'syncing'}
                    data-testid="modal-sync-now-btn"
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    {syncStatus === 'syncing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>今すぐ再同期</span>
                  </button>
                )}
                {onSignOutCloud && (
                  <button
                    type="button"
                    onClick={onSignOutCloud}
                    data-testid="modal-signout-btn"
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ログアウト</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                PCとスマホの両方で同じGoogleアカウントにログインすると、<strong>問題を解くたびにメダル・メモ・途中からの再開位置</strong>が自動でクラウド同期されます。
              </p>
              {onSignInGoogle && (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  data-testid="modal-google-signin-btn"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-md"
                >
                  <LogIn className="w-4 h-4" />
                  <span>GoogleでログインしてPC⇔スマホを自動同期</span>
                </button>
              )}
            </div>
          )}

          {syncError && (
            <div className="flex items-start space-x-2 bg-rose-950/60 border border-rose-500/50 rounded-lg p-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{syncError}</span>
            </div>
          )}
        </div>

        {/* PC <-> Smartphone Easy Sync Code Section */}
        {onGenerateSyncCode && onImportSyncCode && (
          <div className="bg-gradient-to-br from-indigo-950/60 via-slate-950 to-cyan-950/40 border border-indigo-500/40 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold text-white">引き継ぎコード (ログイン不要・手動)</span>
              </div>
              <span className="text-[11px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-semibold">
                記録済み: {totalRecords}問
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              同期コードをコピーしてLINE Keep・メモ・メール等で別端末へ送り、下の欄に貼り付けることでも<strong>メダル・メモ・続きの位置</strong>を引き継げます。
            </p>

            {/* Step 1: Generate & Copy */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopySyncCode}
                data-testid="copy-sync-code-btn"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-md shadow-indigo-950/50"
              >
                {copiedSync ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>同期コードをコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>現在の進捗から「引き継ぎコード」を作成してコピー</span>
                  </>
                )}
              </button>

              {generatedCode && (
                <div className="space-y-1">
                  <textarea
                    readOnly
                    value={generatedCode}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="生成された同期コード"
                    data-testid="generated-sync-code"
                    rows={2}
                    className="w-full bg-slate-950 border border-indigo-500/40 rounded-lg p-2 text-[11px] font-mono text-indigo-200 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Paste & Restore */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <label htmlFor="sync-code-input" className="block text-xs font-bold text-slate-300">
                別端末からの同期コードを貼り付けて復元
              </label>
              <textarea
                id="sync-code-input"
                value={pasteCode}
                onChange={(e) => setPasteCode(e.target.value)}
                placeholder="ここに CCNA1:... から始まる同期コードを貼り付け"
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg p-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3 text-[11px] text-slate-300">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="syncMode"
                      checked={syncMode === 'merge'}
                      onChange={() => setSyncMode('merge')}
                      className="accent-cyan-500"
                    />
                    <span>両端末を統合（推奨）</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="syncMode"
                      checked={syncMode === 'replace'}
                      onChange={() => setSyncMode('replace')}
                      className="accent-cyan-500"
                    />
                    <span>上書き復元</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleApplySyncCode}
                  disabled={!pasteCode.trim()}
                  data-testid="apply-sync-code-btn"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>同期コードを復元</span>
                </button>
              </div>

              {syncFeedback && (
                <div
                  data-testid="sync-feedback"
                  className={`text-xs p-2.5 rounded-lg border ${
                    syncFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  }`}
                >
                  {syncFeedback.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database manifest overview */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-300">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>収録CCNA問題データベース構成</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1">
            <div>投入PDF総数: <strong className="text-white">{DATABASE_MANIFEST.totalIngestedFiles} ファイル</strong></div>
            <div>総問題数: <strong className="text-white">{DATABASE_MANIFEST.totalQuestions} 問</strong></div>
            <div>択一・複数選択: <strong className="text-white">{DATABASE_MANIFEST.breakdown?.multipleChoice || 566} 問</strong></div>
            <div>実機シミュレーション: <strong className="text-white">{DATABASE_MANIFEST.breakdown?.simulations || 75} 問</strong></div>
          </div>
        </div>

        {/* Primary Export Feature */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>ファイル形式でのバックアップ (JSON / ZIP)</span>
          </div>

          <button
            onClick={onExportAllWithHistory}
            className="w-full p-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer text-left space-y-1.5 border border-cyan-400/30 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm sm:text-base flex items-center space-x-2">
                <Download className="w-4 h-4 text-cyan-200 group-hover:translate-y-0.5 transition-transform" />
                <span>全問題データ ＋ 学習履歴を書き出す (全641問)</span>
              </span>
              <span className="text-[11px] bg-white/20 text-white font-bold px-2 py-0.5 rounded">
                推奨
              </span>
            </div>
            <p className="text-xs text-slate-100/90 leading-relaxed">
              <strong>問題文・全選択肢・正答・カテゴリ・解説（show出力・トポロジ含む）・学習履歴（メダル・正解数・連続正解・ユーザメモ）</strong>をすべて1つの完全なJSONファイルとして保存します。
            </p>
          </button>

          {onDownloadProjectZip && (
            <button
              onClick={onDownloadProjectZip}
              className="w-full p-3.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/70 rounded-xl text-indigo-200 flex items-center justify-between text-xs font-bold transition shadow-md shadow-indigo-950/50 cursor-pointer group"
              title="GitHub へのプッシュおよび Vercel デプロイ用の完全ソースコード一式 (ZIP) を即時ダウンロード"
            >
              <span className="flex items-center space-x-2.5">
                <Package className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-left">
                  <span className="block text-white font-bold text-xs sm:text-sm">GitHub + Vercel 公開用 ソースコード一括保存 (ZIP)</span>
                  <span className="text-[11px] text-indigo-300 font-normal">全ソースコード ＋ Firebase設定 ＋ vercel.json ＋ README.md 同梱</span>
                </span>
              </span>
              <span className="px-2.5 py-1 bg-indigo-800/80 text-white font-bold rounded-lg text-xs whitespace-nowrap ml-2">ZIP</span>
            </button>
          )}

          {onDownloadQuestionsJson && (
            <button
              onClick={onDownloadQuestionsJson}
              className="w-full p-3 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-600/60 rounded-xl text-emerald-200 flex items-center justify-between text-xs font-bold transition shadow-sm cursor-pointer"
              title="構文エラー・エスケープ文字修正済みの全641問実データ questions_fixed.json を即時ダウンロード"
            >
              <span className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>修正済み実データ questions_fixed.json をダウンロード (全641問)</span>
              </span>
              <span className="px-2 py-0.5 bg-emerald-800/80 text-emerald-200 rounded text-[11px]">994 KB</span>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={onExportProgressOnly}
              className="flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>学習履歴のみ書き出し (軽量)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>JSONファイルを読み込む (復元)</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Danger zone: inline two-step reset */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="text-xs font-bold text-rose-400">データ初期化</div>
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="w-full flex items-center justify-center space-x-2 p-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>すべての学習履歴をリセット</span>
            </button>
          ) : (
            <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-rose-200">
                本当にこれまでの学習履歴（メダル・正解数・クラウド上の同期データ）をすべて消去しますか？
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setConfirmingReset(false);
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  消去を実行する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
