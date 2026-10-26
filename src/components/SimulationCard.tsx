import React, { useState } from 'react';
import { 
  Terminal, 
  Layers, 
  CheckCircle, 
  HelpCircle, 
  Award, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Copy, 
  RotateCcw, 
  Sparkles, 
  FileText, 
  Cpu, 
  Activity,
  Lightbulb
} from 'lucide-react';
import { QuestionItem, UserProgressRecord, MedalStatus } from '../types/question';

interface SimulationCardProps {
  question: QuestionItem;
  record?: UserProgressRecord;
  currentIndex: number;
  totalQuestions: number;
  onAnswer: (questionId: string, isCorrect: boolean, selectedAnswers: string[]) => void;
  onToggleBookmark: (questionId: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onBackToList: () => void;
}

export const SimulationCard: React.FC<SimulationCardProps> = ({
  question,
  record,
  currentIndex,
  totalQuestions,
  onAnswer,
  onToggleBookmark,
  onNext,
  onPrev,
  onBackToList,
}) => {
  const [activeTab, setActiveTab] = useState<'task' | 'topology' | 'cli' | 'verification' | 'explanation'>('task');
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle command execution in simulated CLI
  const handleExecuteCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim();
    const newHistory = [...cliHistory, `Router# ${cmd}`];

    // Simple interactive CLI feedback
    if (cmd.startsWith('show ip int') || cmd.startsWith('sh ip int')) {
      newHistory.push(question.commandOutputs || 'GigabitEthernet0/0/0  192.168.1.1  YES manual up  up\nGigabitEthernet0/0/1  10.1.1.1     YES manual up  up');
    } else if (cmd.startsWith('show vlan') || cmd.startsWith('sh vl')) {
      newHistory.push('VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------\n1    default                          active    Gi0/1, Gi0/2\n10   Engineering                      active    Gi0/3, Gi0/4\n20   Sales                            active    Gi0/5, Gi0/6');
    } else if (cmd.startsWith('show ip route') || cmd.startsWith('sh ip ro')) {
      newHistory.push('Codes: C - connected, S - static, O - OSPF\nO    192.168.2.0/24 [110/2] via 10.0.0.2, 00:14:22, GigabitEthernet0/1\nC    192.168.1.0/24 is directly connected, GigabitEthernet0/0');
    } else if (cmd.startsWith('conf t') || cmd.startsWith('configure')) {
      newHistory.push('Enter configuration commands, one per line. End with CNTL/Z.');
    } else if (cmd === 'exit' || cmd === 'end') {
      newHistory.push('Router#');
    } else {
      newHistory.push(`[Configured / Executed]: ${cmd}`);
    }

    setCliHistory(newHistory);
    setCliInput('');
  };

  const handleCopySolution = () => {
    if (!question.solution) return;
    navigator.clipboard.writeText(question.solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkMastered = (isMastered: boolean) => {
    onAnswer(question.id, isMastered, ['COMPLETED_SIMULATION']);
  };

  const medalBadge = (medal?: MedalStatus) => {
    switch (medal) {
      case 'gold':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-yellow-400 border border-amber-500/40">
            <Award className="w-3.5 h-3.5" />
            <span>金 (完了)</span>
          </span>
        );
      case 'silver':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-400/20 text-slate-300 border border-slate-400/40">
            <Award className="w-3.5 h-3.5" />
            <span>銀 (演習済)</span>
          </span>
        );
      case 'bronze':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
            <Award className="w-3.5 h-3.5" />
            <span>銅 (挑戦中)</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <span>未出題</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
        <button
          onClick={onBackToList}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>一覧へ戻る</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
            <Terminal className="w-4 h-4" />
            <span>シミュレーション演習: {currentIndex + 1} / {totalQuestions}</span>
          </span>
          <div className="h-3 w-px bg-slate-700" />
          {medalBadge(record?.medal)}
        </div>

        <button
          onClick={() => onToggleBookmark(question.id)}
          className={`p-2 rounded-lg border transition cursor-pointer ${
            record?.isBookmarked 
              ? 'bg-amber-500/20 border-amber-500/50 text-yellow-400' 
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="チェック"
        >
          <Bookmark className={`w-4 h-4 ${record?.isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Title & Metadata Banner */}
        <div className="p-6 bg-slate-950/70 border-b border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
              実機CLIシミュレーション
            </span>
            <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold border border-blue-500/30">
              {question.category}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
              ID: {question.id}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white">
            {question.scenarioTitle || `シナリオタスク: ${question.category}`}
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 overflow-x-auto scrollbar-none px-4">
          <button
            onClick={() => setActiveTab('task')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'task'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📋 タスク要件</span>
          </button>

          <button
            onClick={() => setActiveTab('topology')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'topology'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🗺️ 構成図・トポロジ</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'cli'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>💻 CLI 実践コンソール</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'verification'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>🔍 showコマンド検証</span>
          </button>

          <button
            onClick={() => setActiveTab('explanation')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'explanation'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>💡 模範解答・詳細解説</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* TAB 1: Task Instructions */}
          {activeTab === 'task' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>タスク要求事項 (Requirements)</span>
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {question.questionText}
                </div>
              </div>

              {question.diagramDescription && (
                <div className="p-4 bg-sky-950/20 border border-sky-900/50 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>トポロジ要約</span>
                  </span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {question.diagramDescription.slice(0, 300)}...
                  </p>
                  <button
                    onClick={() => setActiveTab('topology')}
                    className="text-xs text-sky-400 hover:underline font-semibold cursor-pointer"
                  >
                    トポロジ図・構成表を詳しく見る →
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('cli')}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 text-xs sm:text-sm flex items-center space-x-2 cursor-pointer"
                >
                  <Terminal className="w-4 h-4" />
                  <span>CLIコンソールで設定演習を始める</span>
                </button>

                <button
                  onClick={() => setActiveTab('explanation')}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs sm:text-sm flex items-center space-x-2 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  <span>模範設定コマンドを確認する</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Topology & Network Diagram */}
          {activeTab === 'topology' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-cyan-400 flex items-center space-x-2">
                  <Layers className="w-4 h-4" />
                  <span>ネットワークトポロジ・IPアドレッシング・結線図</span>
                </h3>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap overflow-x-auto shadow-inner">
                {question.diagramDescription || '本タスクにはトポロジ図のテキスト説明が含まれていません。'}
              </div>

              {question.commandOutputs && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-400">事前ステータス / show出力:</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-300 whitespace-pre overflow-x-auto">
                    {question.commandOutputs}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Interactive CLI Terminal */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-white">Cisco IOS Simulator Console</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (question.solution) {
                        setCliHistory(prev => [...prev, ...question.solution!.split('\n').filter(Boolean)]);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-medium cursor-pointer"
                  >
                    模範コンフィグ自動投入
                  </button>
                  <button
                    onClick={() => setCliHistory([])}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
                    title="コンソールクリア"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Terminal Screen */}
              <div className="bg-black/90 border border-slate-800 rounded-xl p-4 font-mono text-xs sm:text-sm text-emerald-400 h-80 overflow-y-auto space-y-1 shadow-inner scrollbar-thin">
                <div className="text-slate-500 select-none">
                  --- Cisco IOS Software, CCNA Simulation Environment ---
                </div>
                <div className="text-slate-500 select-none mb-3">
                  Type 'conf t' to configure or type commands directly.
                </div>

                {cliHistory.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed text-emerald-300">
                    {line}
                  </div>
                ))}

                {/* Live Input Form */}
                <form onSubmit={handleExecuteCommand} className="flex items-center space-x-2 pt-2">
                  <span className="text-cyan-400 select-none font-bold">Router(config)#</span>
                  <input
                    type="text"
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    placeholder="コマンドを入力 (例: vlan 10, ip route 0.0.0.0...)"
                    className="flex-1 bg-transparent text-emerald-300 focus:outline-none border-b border-slate-700 focus:border-emerald-500 font-mono text-xs sm:text-sm py-0.5"
                    autoFocus
                  />
                </form>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Enterキーでコマンド実行。模範設定と照合しながら練習できます。</span>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  showコマンド検証へ →
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Verification show commands */}
          {activeTab === 'verification' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-400 flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>動作検証・showコマンド確認ポイント</span>
              </h3>

              {question.verificationCommands && question.verificationCommands.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400">
                    本タスクの動作確認に使用する推奨showコマンド一覧:
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {question.verificationCommands.map((cmd, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg font-mono text-xs sm:text-sm text-cyan-300 flex items-center justify-between">
                        <span># {cmd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl text-slate-400 text-xs sm:text-sm">
                  一般的な検証コマンド: <code>show running-config</code>, <code>show ip interface brief</code>, <code>show ip route</code>
                </div>
              )}

              {question.commandOutputs && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-400">期待される実行結果 / showログ:</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-300 whitespace-pre overflow-x-auto shadow-inner">
                    {question.commandOutputs}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Solution & Explanation */}
          {activeTab === 'explanation' && (
            <div className="space-y-6">
              {/* Solution Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>模範コンフィグレーション (Solution Commands)</span>
                  </h3>
                  <button
                    onClick={handleCopySolution}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'コピー完了！' : '全コマンドをコピー'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-5 font-mono text-xs sm:text-sm text-amber-300 overflow-x-auto shadow-inner leading-relaxed whitespace-pre">
                  {question.solution || question.correctAnswers.join('\n')}
                </div>
              </div>

              {/* Detailed Commentary */}
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-bold text-purple-400 flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>タスク詳細解説・CCNA出題ポイント</span>
                </h3>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {question.explanation}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Completion & Navigation Bar */}
        <div className="p-6 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleMarkMastered(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>「理解した・完了」として記録 (メダル付与)</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>前のタスク</span>
            </button>

            <button
              onClick={onNext}
              disabled={currentIndex >= totalQuestions - 1}
              className="flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <span>次のタスク</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
