import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Terminal, 
  Layers, 
  CheckCircle, 
  CheckCircle2,
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
  Eye,
  EyeOff
} from 'lucide-react';
import { QuestionItem, UserProgressRecord, MedalStatus } from '../types/question';
import { ALL_QUESTIONS } from '../data';
import {
  IosMode,
  RequiredCliStep,
  extractRequiredCliSteps,
  buildSimulationTopology,
  getTabCompletion,
  getContextHelp,
  formatIosPrompt,
  processCliCommand,
} from '../utils/cliEngine';

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

interface TerminalLine {
  id: string;
  text: string;
  type: 'cmd' | 'output' | 'success' | 'help' | 'banner';
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
  // Build visual network topology & required steps for this simulation
  const topology = useMemo(() => buildSimulationTopology(question, ALL_QUESTIONS), [question]);
  const initialSteps = useMemo(() => extractRequiredCliSteps(question), [question]);

  const [steps, setSteps] = useState<RequiredCliStep[]>(initialSteps);
  const [activeDevice, setActiveDevice] = useState<string>(topology.devices[0] || 'R1');
  const [deviceModes, setDeviceModes] = useState<Record<string, IosMode>>({});
  const [deviceLogs, setDeviceLogs] = useState<Record<string, TerminalLine[]>>({});
  const [cliInput, setCliInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [showSolution, setShowSolution] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoAwarded, setAutoAwarded] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when switching simulation task
  useEffect(() => {
    const freshSteps = extractRequiredCliSteps(question);
    setSteps(freshSteps);
    const defaultDev = topology.devices[0] || 'R1';
    setActiveDevice(defaultDev);
    setDeviceModes({});
    setDeviceLogs({});
    setCliInput('');
    setCmdHistory([]);
    setHistoryIdx(-1);
    setShowSolution(false);
    setAutoAwarded(false);
  }, [question.id, topology]);

  const currentMode: IosMode = deviceModes[activeDevice] || 'config';
  const currentPrompt = formatIosPrompt(activeDevice, currentMode);
  const currentLogs: TerminalLine[] = deviceLogs[activeDevice] || [];

  const completedCount = steps.filter(s => s.completed).length;
  const totalStepsCount = steps.length;
  const isAllCompleted = totalStepsCount > 0 && completedCount === totalStepsCount;

  // Automatically record completion when all required commands are entered
  useEffect(() => {
    if (isAllCompleted && !autoAwarded) {
      setAutoAwarded(true);
      onAnswer(question.id, true, ['COMPLETED_SIMULATION']);
    }
  }, [isAllCompleted, autoAwarded, question.id]);

  // Scroll terminal to bottom on new output
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentLogs, activeDevice]);

  const appendLines = (dev: string, lines: Omit<TerminalLine, 'id'>[]) => {
    setDeviceLogs(prev => {
      const existing = prev[dev] || [];
      const next = [
        ...existing,
        ...lines.map((l, idx) => ({ ...l, id: `${Date.now()}_${ existing.length + idx }` })),
      ];
      return { ...prev, [dev]: next };
    });
  };

  // Execute command on Enter
  const handleExecuteCommand = (e?: React.FormEvent, overrideCmd?: string) => {
    if (e) e.preventDefault();
    const raw = overrideCmd !== undefined ? overrideCmd : cliInput;

    // Empty enter just prints prompt line
    if (!raw.trim()) {
      appendLines(activeDevice, [{ text: currentPrompt, type: 'cmd' }]);
      setCliInput('');
      return;
    }

    const cmd = raw.trim();

    // If user typed '?' at end and pressed Enter, show context help
    if (cmd.endsWith('?')) {
      const devSteps = steps.filter(s => s.device === activeDevice.toUpperCase());
      const helpLines = getContextHelp(cmd, currentMode, devSteps);
      appendLines(activeDevice, [
        { text: `${currentPrompt} ${cmd}`, type: 'cmd' },
        ...helpLines.map(h => ({ text: h, type: 'help' as const })),
      ]);
      setCliInput(cmd.replace(/\?+$/, ''));
      return;
    }

    const result = processCliCommand(cmd, activeDevice, currentMode, steps, question);
    const newLines: Omit<TerminalLine, 'id'>[] = [
      { text: `${currentPrompt} ${cmd}`, type: 'cmd' },
      ...result.outputLines.map(o => ({ text: o, type: 'output' as const })),
    ];

    if (result.matchedStep) {
      const newCompletedCount = result.updatedSteps.filter(s => s.completed).length;
      newLines.push({
        text: `✓ [Ping-t 判定] 正しい設定コマンドを確認しました！ (${newCompletedCount}/${result.updatedSteps.length} ステップ完了)`,
        type: 'success',
      });
    }

    appendLines(activeDevice, newLines);
    setDeviceModes(prev => ({ ...prev, [activeDevice]: result.nextMode }));
    setSteps(result.updatedSteps);
    setCmdHistory(prev => [cmd, ...prev.slice(0, 29)]);
    setHistoryIdx(-1);
    setCliInput('');
  };

  // Trigger Tab completion
  const triggerTabCompletion = () => {
    const devSteps = steps.filter(s => s.device === activeDevice.toUpperCase());
    const { completedInput, suggestions } = getTabCompletion(cliInput, currentMode, devSteps);
    if (completedInput !== cliInput) {
      setCliInput(completedInput);
    } else if (suggestions.length > 1) {
      appendLines(activeDevice, [
        { text: `${currentPrompt} ${cliInput}`, type: 'cmd' },
        { text: suggestions.join('    '), type: 'help' },
      ]);
    }
    inputRef.current?.focus();
  };

  // Trigger '?' context-sensitive help immediately (just like real Cisco IOS!)
  const triggerContextHelp = () => {
    const devSteps = steps.filter(s => s.device === activeDevice.toUpperCase());
    const helpLines = getContextHelp(cliInput, currentMode, devSteps);
    appendLines(activeDevice, [
      { text: `${currentPrompt} ${cliInput}?`, type: 'cmd' },
      ...helpLines.map(h => ({ text: h, type: 'help' as const })),
    ]);
    inputRef.current?.focus();
  };

  // Keyboard handler on CLI input for Tab, ?, Up/Down arrows
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      triggerTabCompletion();
    } else if (e.key === '?') {
      e.preventDefault();
      triggerContextHelp();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0 && historyIdx < cmdHistory.length - 1) {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setCliInput(cmdHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setCliInput(cmdHistory[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setCliInput('');
      }
    }
  };

  // Auto-fill all remaining solution steps into the console (for quick learning/verification)
  const handleAutoRunSolution = () => {
    let updated = [...steps];
    const logsByDev: Record<string, TerminalLine[]> = { ...deviceLogs };
    const modesByDev: Record<string, IosMode> = { ...deviceModes };

    for (const step of updated) {
      if (step.completed) continue;
      const dev = step.device;
      const mode = modesByDev[dev] || 'config';
      const prompt = formatIosPrompt(dev, mode);
      const res = processCliCommand(step.rawCommand, dev, mode, updated, question);
      updated = res.updatedSteps;
      modesByDev[dev] = res.nextMode;
      const existing = logsByDev[dev] || [];
      logsByDev[dev] = [
        ...existing,
        { id: `${Date.now()}_${Math.random()}`, text: `${prompt} ${step.rawCommand}`, type: 'cmd' },
        {
          id: `${Date.now()}_${Math.random()}`,
          text: `✓ [Ping-t 判定] 設定完了: ${step.rawCommand}`,
          type: 'success',
        },
      ];
    }

    setSteps(updated);
    setDeviceLogs(logsByDev);
    setDeviceModes(modesByDev);
    setCliInput('');
  };

  const handleCopySolution = () => {
    const text = question.solution || question.correctAnswers.join('\n');
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToList}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition cursor-pointer bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>一覧へ戻る</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center space-x-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>実機CLIシミュレーション ({currentIndex + 1} / {totalQuestions})</span>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
              ID: {question.id}
            </span>
          </div>
        </div>

        {/* Center Live Ping-t Completion Status Indicator */}
        <div
          data-testid="sim-completion-banner"
          className={`flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl border transition-all duration-300 ${
            isAllCompleted
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/20'
              : completedCount > 0
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-800/90 border-slate-700 text-slate-300'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${isAllCompleted ? 'text-emerald-400 animate-bounce' : 'text-cyan-400'}`} />
          <span className="text-xs font-bold">
            {isAllCompleted
              ? `🎉 全コマンド正解・設定完了！ (${completedCount}/${totalStepsCount})`
              : `設定進捗: ${completedCount} / ${totalStepsCount} ステップ完了`}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {medalBadge(record?.medal)}
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
      </div>

      {/* SPLIT-SCREEN MAIN WORKSPACE: Left = Topology Diagram + Problem Statement, Right = Cisco CLI Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT PANE (5 cols on desktop): Visual Topology Diagram + Problem Statement + Step Progress */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* 1. Interactive SVG Network Topology Diagram (構成図) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">
                  ネットワーク構成図 ({question.scenarioTitle || question.id})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                機器アイコンをクリックしてコンソール切替
              </span>
            </div>

            {/* Visual SVG Topology Canvas */}
            <div className="p-3 bg-slate-950/60 flex flex-col items-center">
              <svg
                viewBox="0 0 600 330"
                className="w-full h-56 sm:h-64 bg-slate-950 rounded-xl border border-slate-800/80 shadow-inner select-none"
                data-testid="sim-topology-svg"
              >
                <defs>
                  <linearGradient id="routerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="100%" stopColor="#0369a1" />
                  </linearGradient>
                  <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#0f766e" />
                  </linearGradient>
                  <linearGradient id="completedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>

                {/* Subtle grid lines */}
                <g stroke="#1e293b" strokeWidth="0.5" opacity="0.5">
                  <line x1="0" y1="80" x2="600" y2="80" />
                  <line x1="0" y1="165" x2="600" y2="165" />
                  <line x1="0" y1="250" x2="600" y2="250" />
                  <line x1="150" y1="0" x2="150" y2="330" />
                  <line x1="300" y1="0" x2="300" y2="330" />
                  <line x1="450" y1="0" x2="450" y2="330" />
                </g>

                {/* Network Links */}
                {topology.links.map((link, idx) => {
                  const fromNode = topology.nodes.find(n => n.id === link.from);
                  const toNode = topology.nodes.find(n => n.id === link.to);
                  if (!fromNode || !toNode) return null;
                  const midX = (fromNode.x + toNode.x) / 2;
                  const midY = (fromNode.y + toNode.y) / 2;

                  return (
                    <g key={idx}>
                      {link.isTrunkOrPo ? (
                        <>
                          <line
                            x1={fromNode.x - 2}
                            y1={fromNode.y - 2}
                            x2={toNode.x - 2}
                            y2={toNode.y - 2}
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                          />
                          <line
                            x1={fromNode.x + 2}
                            y1={fromNode.y + 2}
                            x2={toNode.x + 2}
                            y2={toNode.y + 2}
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                          />
                        </>
                      ) : (
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke={isAllCompleted ? '#10b981' : '#64748b'}
                          strokeWidth="2.5"
                        />
                      )}

                      {/* Port labels near endpoints */}
                      {link.fromPort && (
                        <text
                          x={fromNode.x + (toNode.x - fromNode.x) * 0.26}
                          y={fromNode.y + (toNode.y - fromNode.y) * 0.26 - 5}
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {link.fromPort}
                        </text>
                      )}
                      {link.toPort && (
                        <text
                          x={fromNode.x + (toNode.x - fromNode.x) * 0.74}
                          y={fromNode.y + (toNode.y - fromNode.y) * 0.74 - 5}
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {link.toPort}
                        </text>
                      )}
                      {link.subnetLabel && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-52"
                            y="-9"
                            width="104"
                            height="16"
                            rx="4"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="3"
                            fill="#38bdf8"
                            fontSize="9.5"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {link.subnetLabel}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Network Device Nodes */}
                {topology.nodes.map(node => {
                  const isConfigurable = topology.devices.includes(node.id);
                  const isSelected = activeDevice.toUpperCase() === node.id;
                  const devSteps = steps.filter(s => s.device === node.id);
                  const isDevCompleted = devSteps.length > 0 && devSteps.every(s => s.completed);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => {
                        if (isConfigurable) setActiveDevice(node.id);
                      }}
                      className={isConfigurable ? 'cursor-pointer' : ''}
                    >
                      {/* Active selection glow ring */}
                      {isSelected && (
                        <circle
                          r="31"
                          fill="none"
                          stroke={isDevCompleted ? '#10b981' : '#22d3ee'}
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* Router Icon (Circle with cross arrows) */}
                      {node.type === 'router' && (
                        <g>
                          <circle
                            r="24"
                            fill={isDevCompleted ? 'url(#completedGrad)' : 'url(#routerGrad)'}
                            stroke={isSelected ? '#ffffff' : '#38bdf8'}
                            strokeWidth="2"
                          />
                          <path
                            d="M-12 0 L12 0 M0 -12 L0 12 M-8 -4 L-12 0 L-8 4 M8 -4 L12 0 L8 4"
                            stroke="#e0f2fe"
                            strokeWidth="1.8"
                            fill="none"
                          />
                        </g>
                      )}

                      {/* Switch Icon (Rounded box with horizontal arrows) */}
                      {node.type === 'switch' && (
                        <g>
                          <rect
                            x="-28"
                            y="-18"
                            width="56"
                            height="36"
                            rx="7"
                            fill={isDevCompleted ? 'url(#completedGrad)' : 'url(#switchGrad)'}
                            stroke={isSelected ? '#ffffff' : '#2dd4bf'}
                            strokeWidth="2"
                          />
                          <path
                            d="M-16 -5 L16 -5 M10 -9 L16 -5 L10 -1 M16 5 L-16 5 M-10 1 L-16 5 L-10 9"
                            stroke="#ccfbf1"
                            strokeWidth="1.6"
                            fill="none"
                          />
                        </g>
                      )}

                      {/* PC / Server / Cloud Icon */}
                      {(node.type === 'pc' || node.type === 'server' || node.type === 'cloud') && (
                        <g>
                          <rect
                            x="-22"
                            y="-16"
                            width="44"
                            height="32"
                            rx="5"
                            fill="#1e293b"
                            stroke="#64748b"
                            strokeWidth="1.8"
                          />
                          <rect x="-15" y="-11" width="30" height="16" rx="2" fill="#0f172a" />
                          <line x1="-10" y1="11" x2="10" y2="11" stroke="#94a3b8" strokeWidth="2" />
                        </g>
                      )}

                      {/* Device Name Label */}
                      <text
                        y="36"
                        fill={isDevCompleted ? '#34d399' : isSelected ? '#22d3ee' : '#f8fafc'}
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {node.label} {isDevCompleted ? '✓' : ''}
                      </text>

                      {/* Optional IP / VLAN sub-label */}
                      {node.ipInfo && (
                        <text
                          y="49"
                          fill="#94a3b8"
                          fontSize="9.5"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {node.ipInfo}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Textual Topology Details Box (Addressing / Port Table) */}
              {question.diagramDescription && (
                <div className="w-full mt-2.5 p-3 bg-slate-900/90 border border-slate-800 rounded-xl font-mono text-xs text-cyan-200 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {question.diagramDescription}
                </div>
              )}
            </div>
          </div>

          {/* 2. Task Problem Statement & Ping-t Live Step Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl flex-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>問題文・タスク要件</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                {question.category}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {question.questionText}
            </div>

            {/* Ping-t Style Real-Time Command Progress Checklist */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ping-t リアルタイム判定チェックリスト</span>
                </span>
                <span className={`text-xs font-mono font-bold ${isAllCompleted ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {completedCount} / {totalStepsCount} 完了
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  style={{ width: `${totalStepsCount > 0 ? Math.round((completedCount / totalStepsCount) * 100) : 0}%` }}
                  className={`h-full transition-all duration-300 ${
                    isAllCompleted ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                />
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    onClick={() => setActiveDevice(step.device)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition cursor-pointer ${
                      step.completed
                        ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200 shadow-sm shadow-emerald-950/50'
                        : activeDevice === step.device
                          ? 'bg-slate-950 border-slate-700 text-slate-300'
                          : 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        step.completed
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {step.completed ? '✓' : idx + 1}
                      </span>
                      <span className="font-bold text-cyan-400 shrink-0">[{step.device}]</span>
                      <span className="truncate">
                        {step.completed || showSolution
                          ? step.rawCommand
                          : `${step.rawCommand.split(' ')[0]} ... (?キーまたは解答表示で確認)`}
                      </span>
                    </div>
                    <span className={`text-[10px] font-sans font-bold px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                      step.completed
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {step.completed ? 'OK!' : '未入力'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE (7 cols on desktop): Authentic Cisco IOS CLI Console */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div
            className={`bg-slate-900 border-2 rounded-2xl overflow-hidden shadow-2xl flex flex-col flex-1 transition-colors duration-300 ${
              isAllCompleted
                ? 'border-emerald-500/80 shadow-emerald-950/30'
                : 'border-slate-800'
            }`}
          >
            {/* Console Top Bar: Device Selector Tabs & Action Buttons */}
            <div className="bg-slate-950 border-b border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2">
              {/* Device Tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto">
                <Cpu className="w-4 h-4 text-cyan-400 mr-1 shrink-0" />
                {topology.devices.map(dev => {
                  const devSteps = steps.filter(s => s.device === dev);
                  const isDevDone = devSteps.length > 0 && devSteps.every(s => s.completed);
                  const isCurrent = activeDevice === dev;

                  return (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => {
                        setActiveDevice(dev);
                        inputRef.current?.focus();
                      }}
                      data-testid={`cli-device-tab-${dev}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                        isCurrent
                          ? isDevDone
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                          : isDevDone
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/50'
                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <span>{dev}</span>
                      {devSteps.length > 0 && (
                        <span className="text-[10px] opacity-90">
                          ({devSteps.filter(s => s.completed).length}/{devSteps.length})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Assist & Solution Controls */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={triggerTabCompletion}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                  title="Tabキー補完"
                >
                  Tab補完
                </button>
                <button
                  type="button"
                  onClick={triggerContextHelp}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                  title="? ヘルプ表示"
                >
                  ? ヘルプ
                </button>
                <button
                  type="button"
                  onClick={handleAutoRunSolution}
                  data-testid="sim-autorun-btn"
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                  title="模範解答コマンドをコンソールに自動入力して動作確認"
                >
                  模範コマンド自動投入
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceLogs({});
                    setSteps(extractRequiredCliSteps(question));
                    setAutoAwarded(false);
                  }}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
                  title="コンソールと進捗をリセット"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Ping-t Completion Celebration Banner inside Console when all steps are done */}
            {isAllCompleted && (
              <div className="bg-emerald-600/25 border-b border-emerald-500/50 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200 animate-fadeIn">
                <div className="flex items-center space-x-2 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>すべての必須コンフィグが正しく入力されました！（ステータス：正解・完了）</span>
                </div>
                <button
                  type="button"
                  onClick={onNext}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shrink-0"
                >
                  次のタスクへ →
                </button>
              </div>
            )}

            {/* Terminal Output Area */}
            <div
              onClick={() => inputRef.current?.focus()}
              className={`flex-1 p-4 font-mono text-xs sm:text-sm overflow-y-auto space-y-1.5 min-h-[380px] max-h-[520px] cursor-text transition-colors ${
                isAllCompleted ? 'bg-emerald-950/20' : 'bg-[#070b14]'
              }`}
            >
              <div className="text-slate-500 select-none leading-relaxed">
                Cisco IOS Software, CCNA (200-301) Real CLI Simulator — Device: <span className="text-cyan-400 font-bold">{activeDevice}</span>
                <br />
                * <span className="text-slate-400">Tabキー</span>でコマンド自動補完、<span className="text-slate-400">?キー</span>でコンテキストヘルプ・候補一覧を表示します。
                <br />
                * 省略形（例: <span className="text-slate-400">conf t</span>, <span className="text-slate-400">int e0/0</span>, <span className="text-slate-400">sw m a</span>, <span className="text-slate-400">copy run start</span>）にも完全対応しています。
              </div>

              {question.commandOutputs && currentLogs.length === 0 && (
                <div className="my-2 p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-cyan-300 whitespace-pre-wrap text-xs">
                  <div className="text-[11px] text-slate-400 mb-1 font-sans">【初期状態 / showコマンド出力】:</div>
                  {question.commandOutputs}
                </div>
              )}

              {currentLogs.map(line => (
                <div
                  key={line.id}
                  className={`whitespace-pre-wrap leading-relaxed ${
                    line.type === 'cmd'
                      ? 'text-slate-100 font-bold'
                      : line.type === 'success'
                        ? 'text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-md font-semibold'
                        : line.type === 'help'
                          ? 'text-amber-300/95 pl-2'
                          : 'text-cyan-300 pl-1'
                  }`}
                >
                  {line.text}
                </div>
              ))}

              {/* Active CLI Input Prompt Line */}
              <form onSubmit={handleExecuteCommand} className="flex items-center space-x-2 pt-2">
                <span
                  className={`select-none font-bold shrink-0 ${
                    isAllCompleted ? 'text-emerald-400' : 'text-cyan-400'
                  }`}
                >
                  {currentPrompt}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  data-testid="cli-input"
                  aria-label="Cisco IOS CLI コマンド入力"
                  placeholder="コマンドを入力 (Tabで補完, ?でヘルプ, Enterで実行)"
                  className="flex-1 bg-transparent text-emerald-300 focus:outline-none font-mono text-xs sm:text-sm py-0.5 caret-emerald-400"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
              <div ref={terminalEndRef} />
            </div>

            {/* Console Bottom Shortcut Bar (Helpful on both Desktop & Mobile) */}
            <div className="bg-slate-950 border-t border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">クイック入力:</span>
                {['conf t', 'show ip int brief', 'show run', 'exit', 'copy run start'].map(quickCmd => (
                  <button
                    key={quickCmd}
                    type="button"
                    onClick={() => handleExecuteCommand(undefined, quickCmd)}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono text-[11px] cursor-pointer"
                  >
                    {quickCmd}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowSolution(prev => !prev)}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold text-xs cursor-pointer"
              >
                {showSolution ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showSolution ? '模範解答・解説を隠す' : '模範解答・解説を表示'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Solution & Detailed Explanation Drawer */}
          {showSolution && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="text-sm font-bold text-amber-400 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span>模範コンフィグレーション & 解説</span>
                </h3>
                <button
                  onClick={handleCopySolution}
                  className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'コピー完了！' : '全コマンドをコピー'}</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-4 font-mono text-xs sm:text-sm text-amber-300 overflow-x-auto leading-relaxed whitespace-pre">
                {question.solution || question.correctAnswers.join('\n')}
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-purple-400 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>詳細解説</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {question.explanation}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Completion & Task Navigation Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onAnswer(question.id, true, ['COMPLETED_SIMULATION'])}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer transition ${
              isAllCompleted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            }`}
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
  );
};
