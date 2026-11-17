import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '予期しないエラーが発生しました。',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      let parsedFirestoreInfo: { error?: string; operationType?: string; path?: string } | null =
        null;
      try {
        const candidate = JSON.parse(this.state.message);
        if (candidate && typeof candidate === 'object' && 'operationType' in candidate) {
          parsedFirestoreInfo = candidate;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold text-white">同期・システムエラーが発生しました</h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              クラウド同期処理中にエラーが発生しました。端末内の学習履歴（localStorage）は保護されています。
            </p>

            {parsedFirestoreInfo ? (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-rose-300 space-y-1 break-all">
                <div>操作: {parsedFirestoreInfo.operationType}</div>
                {parsedFirestoreInfo.path && <div>パス: {parsedFirestoreInfo.path}</div>}
                <div>詳細: {parsedFirestoreInfo.error}</div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-rose-300 break-all">
                {this.state.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>画面を復旧する</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
