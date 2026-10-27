import React, { useRef } from 'react';
import { HardDrive, Download, Upload, Trash2, X, CheckCircle, Database, FileSpreadsheet, Sparkles, Package } from 'lucide-react';
import { DATABASE_MANIFEST } from '../data';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportAllWithHistory: () => void;
  onExportProgressOnly: () => void;
  onImport: (jsonStr: string) => void;
  onReset: () => void;
  totalRecords: number;
  onDownloadQuestionsJson?: () => void;
  onDownloadProjectZip?: () => void;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImport(content);
        onClose();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">問題データ ＆ 学習履歴エクスポート</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
            <span>全データ一括エクスポート (JSON形式)</span>
          </div>

          {/* Master Export Button */}
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

          {/* GitHub / Vercel Project ZIP Export */}
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
                  <span className="text-[11px] text-indigo-300 font-normal">全ソースコード ＋ questions_fixed.json ＋ vercel.json ＋ README.md 同梱</span>
                </span>
              </span>
              <span className="px-2.5 py-1 bg-indigo-800/80 text-white font-bold rounded-lg text-xs whitespace-nowrap ml-2">746 KB</span>
            </button>
          )}

          {/* Direct Static Download */}
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

          {/* Secondary Options */}
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

        {/* Danger zone: reset */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="text-xs font-bold text-rose-400">データ初期化</div>
          <button
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 p-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>すべての学習履歴をリセット</span>
          </button>
        </div>
      </div>
    </div>
  );
};
