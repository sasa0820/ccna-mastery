import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Bookmark, 
  Check, 
  X, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft, 
  Terminal, 
  Info, 
  Edit3, 
  Save, 
  RotateCcw,
  Sparkles,
  GripVertical,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { QuestionItem, UserProgressRecord, MedalStatus } from '../types/question';
import { parseDragDropQuestion, evaluateDragDropAssignments } from '../utils/dragDropEngine';

interface QuestionCardProps {
  question: QuestionItem;
  record?: UserProgressRecord;
  currentIndex: number;
  totalQuestions: number;
  onAnswer: (questionId: string, isCorrect: boolean, selectedAnswers: string[]) => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onBackToList: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  record,
  currentIndex,
  totalQuestions,
  onAnswer,
  onToggleBookmark,
  onSaveNote,
  onNext,
  onPrev,
  onBackToList,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [noteText, setNoteText] = useState(record?.userNote || '');
  const [showDiagram, setShowDiagram] = useState(true);

  // Drag & Drop state
  const isDragAndDrop = question.type === 'drag_and_drop';
  const parsedDnd = useMemo(() => {
    if (!isDragAndDrop) return null;
    return parseDragDropQuestion(question);
  }, [question]);

  const [dndAssignments, setDndAssignments] = useState<Record<string, string[]>>({});
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Determine if regular choice question accepts multiple answers
  const isMultiple = !isDragAndDrop && question.correctAnswers.length > 1;

  // Reset state when switching question
  useEffect(() => {
    setIsAnswered(false);
    setSelectedAnswers(record?.lastSelectedAnswers || []);
    setNoteText(record?.userNote || '');
    setDndAssignments({});
    setActiveDragItemId(null);
    setDragOverTargetId(null);
  }, [question.id]);

  // Regular choice selection
  const handleSelectOption = (optionId: string) => {
    if (isAnswered) return;

    if (isMultiple) {
      if (selectedAnswers.includes(optionId)) {
        setSelectedAnswers(selectedAnswers.filter(id => id !== optionId));
      } else {
        setSelectedAnswers([...selectedAnswers, optionId]);
      }
    } else {
      setSelectedAnswers([optionId]);
    }
  };

  // Assign an item to a Drag-and-Drop target slot
  const assignItemToTarget = (itemId: string, targetId: string) => {
    if (isAnswered || !parsedDnd) return;

    const target = parsedDnd.targets.find(t => t.id === targetId);
    if (!target) return;

    setDndAssignments(prev => {
      const next: Record<string, string[]> = {};
      // Remove itemId from any existing target first
      for (const [k, list] of Object.entries(prev)) {
        next[k] = list.filter(id => id !== itemId);
      }
      const currentInTarget = next[targetId] || [];
      if (target.maxItems === 1) {
        // Replace existing item in 1-to-1 matching slot
        next[targetId] = [itemId];
      } else {
        next[targetId] = [...currentInTarget, itemId];
      }
      return next;
    });
    setActiveDragItemId(null);
  };

  const removeItemFromTarget = (itemId: string, targetId: string) => {
    if (isAnswered) return;
    setDndAssignments(prev => ({
      ...prev,
      [targetId]: (prev[targetId] || []).filter(id => id !== itemId),
    }));
  };

  // All assigned item IDs in DnD
  const assignedItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const list of Object.values(dndAssignments)) {
      for (const id of list) set.add(id);
    }
    return set;
  }, [dndAssignments]);

  const dndEvaluation = useMemo(() => {
    if (!parsedDnd) return null;
    return evaluateDragDropAssignments(parsedDnd, dndAssignments);
  }, [parsedDnd, dndAssignments]);

  const canSubmit = isDragAndDrop
    ? assignedItemIds.size > 0
    : selectedAnswers.length > 0;

  const handleSubmitAnswer = () => {
    if (!canSubmit) return;

    if (isDragAndDrop && parsedDnd && dndEvaluation) {
      const isCorrect = dndEvaluation.isAllCorrect;
      const summary = parsedDnd.targets.map(t => {
        const labels = (dndAssignments[t.id] || [])
          .map(id => parsedDnd.items.find(it => it.id === id)?.label || id)
          .join('、');
        return `${t.title}: ${labels}`;
      });
      setIsAnswered(true);
      onAnswer(question.id, isCorrect, summary);
      return;
    }

    // Regular choice correctness check: sorted equality
    const sortedSelected = [...selectedAnswers].sort();
    const sortedCorrect = [...question.correctAnswers].sort();
    const isCorrect = 
      sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every((val, index) => val.trim().toUpperCase() === sortedCorrect[index].trim().toUpperCase());

    setIsAnswered(true);
    onAnswer(question.id, isCorrect, selectedAnswers);
  };

  const handleSaveUserNote = () => {
    onSaveNote(question.id, noteText);
    setIsNoteEditing(false);
  };

  const isCurrentCorrect = isAnswered && (() => {
    if (isDragAndDrop && dndEvaluation) {
      return dndEvaluation.isAllCorrect;
    }
    const s = [...selectedAnswers].sort();
    const c = [...question.correctAnswers].sort();
    return s.length === c.length && s.every((v, i) => v.trim().toUpperCase() === c[i].trim().toUpperCase());
  })();

  const medalBadge = (medal?: MedalStatus) => {
    switch (medal) {
      case 'gold':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-yellow-400 border border-amber-500/40">
            <Award className="w-3.5 h-3.5" />
            <span>金メダル</span>
          </span>
        );
      case 'silver':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-400/20 text-slate-300 border border-slate-400/40">
            <Award className="w-3.5 h-3.5" />
            <span>銀メダル</span>
          </span>
        );
      case 'bronze':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
            <Award className="w-3.5 h-3.5" />
            <span>銅メダル</span>
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
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
        <button
          onClick={onBackToList}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>一覧へ戻る</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-300">
            問 {currentIndex + 1} / {totalQuestions}
          </span>
          <div className="h-3 w-px bg-slate-700" />
          {medalBadge(record?.medal)}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggleBookmark(question.id)}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              record?.isBookmarked 
                ? 'bg-amber-500/20 border-amber-500/50 text-yellow-400' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={record?.isBookmarked ? 'チェック解除' : 'チェックに追加 (復習用)'}
          >
            <Bookmark className={`w-4 h-4 ${record?.isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Question Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold border border-blue-500/30">
            {question.category}
          </span>
          {question.part && (
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
              {question.part}
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-xs font-mono">
            ID: {question.id}
          </span>
          {isDragAndDrop ? (
            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center space-x-1">
              <GripVertical className="w-3.5 h-3.5" />
              <span>ドラッグ＆ドロップ問題 (分類・マッチング)</span>
            </span>
          ) : isMultiple ? (
            <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
              複数選択 ({question.correctAnswers.length}つ選択)
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300 text-xs font-semibold border border-cyan-500/30">
              単一選択 (1つ選択)
            </span>
          )}
        </div>

        {/* Question Text */}
        <div className="text-slate-100 text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap">
          {question.questionText}
        </div>

        {/* Command Output Block (show command / config example) */}
        {question.commandOutputs && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center space-x-1">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>コマンド出力 / コンフィグレーション例:</span>
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto shadow-inner leading-relaxed whitespace-pre">
              {question.commandOutputs}
            </div>
          </div>
        )}

        {/* Diagram / Topology Description Box */}
        {question.diagramDescription && (
          <div className="border border-sky-900/60 bg-sky-950/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                <Info className="w-4 h-4" />
                <span>【ネットワーク図・トポロジ構成の内容】</span>
              </span>
              <button
                onClick={() => setShowDiagram(!showDiagram)}
                className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                {showDiagram ? '閉じる' : '表示する'}
              </button>
            </div>
            {showDiagram && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-sky-800/30">
                {question.diagramDescription}
              </p>
            )}
          </div>
        )}

        {/* DRAG AND DROP INTERACTIVE BOARD */}
        {isDragAndDrop && parsedDnd ? (
          <div className="space-y-5 pt-2" data-testid="dnd-board">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
              <div className="text-xs text-slate-300 flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  左側の選択肢をドラッグ＆ドロップするか、<strong>選択肢をクリック → 右側の枠をクリック</strong>して配置してください。
                </span>
              </div>
              {!isAnswered && assignedItemIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDndAssignments({});
                    setActiveDragItemId(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>配置をリセット</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Source Draggable Items Pool */}
              <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    選択肢プール ({parsedDnd.items.length - assignedItemIds.size} / {parsedDnd.items.length})
                  </span>
                  {activeDragItemId && (
                    <span className="text-[11px] text-amber-400 font-semibold animate-pulse">
                      移動先の枠をクリックしてください →
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {parsedDnd.items.map(item => {
                    const isAssigned = assignedItemIds.has(item.id);
                    const isSelectedForClick = activeDragItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        draggable={!isAnswered && !isAssigned}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id);
                          setActiveDragItemId(item.id);
                        }}
                        onDragEnd={() => {
                          setDragOverTargetId(null);
                        }}
                        onClick={() => {
                          if (isAnswered || isAssigned) return;
                          setActiveDragItemId(prev => (prev === item.id ? null : item.id));
                        }}
                        data-testid={`dnd-item-${item.id}`}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm transition select-none ${
                          isAssigned
                            ? 'bg-slate-900/30 border-slate-800/60 text-slate-500 opacity-45 line-through cursor-default'
                            : isSelectedForClick
                              ? 'bg-amber-500/20 border-amber-400 text-amber-100 ring-2 ring-amber-400/50 shadow-lg cursor-pointer'
                              : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-100 cursor-grab active:cursor-grabbing shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col space-y-2 w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <GripVertical className={`w-4 h-4 shrink-0 ${isAssigned ? 'text-slate-600' : 'text-amber-400'}`} />
                              <span className="leading-relaxed">{item.label}</span>
                            </div>
                            {isAssigned ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0 ml-2">
                                配置済
                              </span>
                            ) : (
                              <ArrowRight className={`w-4 h-4 shrink-0 ml-2 ${isSelectedForClick ? 'text-amber-400' : 'text-slate-500'}`} />
                            )}
                          </div>

                          {/* 1-Click Direct Target Buttons for fast assignment */}
                          {!isAssigned && !isAnswered && parsedDnd.targets.length <= 4 && (
                            <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-1">
                              {parsedDnd.targets.map((t, tIdx) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  data-testid={`dnd-quick-${item.id}-${t.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    assignItemToTarget(item.id, t.id);
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium transition cursor-pointer"
                                >
                                  → {t.title.length > 16 ? `枠${tIdx + 1}` : t.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Target Drop Zones / Categories */}
              <div className="lg:col-span-7 space-y-3">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider px-1">
                  ドロップ先ターゲット ({parsedDnd.targets.length}枠)
                </div>

                <div className="space-y-3">
                  {parsedDnd.targets.map(target => {
                    const assignedIds = dndAssignments[target.id] || [];
                    const isOver = dragOverTargetId === target.id;
                    const isTargetCorrect = isAnswered && dndEvaluation?.targetResults[target.id];

                    return (
                      <div
                        key={target.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isAnswered) setDragOverTargetId(target.id);
                        }}
                        onDragLeave={() => setDragOverTargetId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverTargetId(null);
                          const droppedId = e.dataTransfer.getData('text/plain') || activeDragItemId;
                          if (droppedId) {
                            assignItemToTarget(droppedId, target.id);
                          }
                        }}
                        onClick={() => {
                          if (!isAnswered && activeDragItemId) {
                            assignItemToTarget(activeDragItemId, target.id);
                          }
                        }}
                        data-testid={`dnd-target-${target.id}`}
                        className={`rounded-xl border-2 p-4 transition-all ${
                          isAnswered
                            ? isTargetCorrect
                              ? 'bg-emerald-950/30 border-emerald-500/70'
                              : 'bg-rose-950/30 border-rose-500/70'
                            : isOver || activeDragItemId
                              ? 'bg-cyan-950/30 border-cyan-400 border-dashed cursor-pointer shadow-md shadow-cyan-950/30'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="font-bold text-sm sm:text-base text-white flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span>{target.title}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {assignedIds.length} / {target.maxItems}
                          </span>
                        </div>

                        {/* Assigned items inside this target */}
                        {assignedIds.length > 0 ? (
                          <div className="space-y-2">
                            {assignedIds.map(itemId => {
                              const itemObj = parsedDnd.items.find(i => i.id === itemId);
                              const isItemExpectedHere = target.expectedItemIds.includes(itemId);
                              return (
                                <div
                                  key={itemId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeItemFromTarget(itemId, target.id);
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs sm:text-sm ${
                                    isAnswered
                                      ? isItemExpectedHere
                                        ? 'bg-emerald-900/40 border-emerald-500/60 text-emerald-100'
                                        : 'bg-rose-900/40 border-rose-500/60 text-rose-200 line-through'
                                      : 'bg-blue-950/60 border-blue-500/60 text-blue-100 hover:bg-rose-950/40 hover:border-rose-500/50 cursor-pointer'
                                  }`}
                                  title={isAnswered ? '' : 'クリックして外す'}
                                >
                                  <span className="font-medium">{itemObj?.label || itemId}</span>
                                  {!isAnswered ? (
                                    <X className="w-4 h-4 text-slate-400 hover:text-rose-400 shrink-0 ml-2" />
                                  ) : isItemExpectedHere ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                                  ) : (
                                    <X className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            {activeDragItemId
                              ? 'ここをクリックして選択中の項目を配置'
                              : 'ここに項目をドラッグ＆ドロップ'}
                          </div>
                        )}

                        {/* Show expected items after answering if wrong */}
                        {isAnswered && !isTargetCorrect && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-emerald-300 space-y-1">
                            <div className="font-bold text-emerald-400">正解の配置:</div>
                            {target.expectedItemIds.map(eid => {
                              const it = parsedDnd.items.find(i => i.id === eid);
                              return (
                                <div key={eid} className="flex items-center space-x-1.5">
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>{it?.label || eid}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* REGULAR SINGLE / MULTIPLE CHOICE OPTIONS */
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isMultiple ? `選択肢（${question.correctAnswers.length}つ選択）:` : '選択肢（1つ選択）:'}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {question.options && question.options.length > 0 ? (
                question.options.map((option) => {
                  const isSelected = selectedAnswers.includes(option.id);
                  const isCorrectOption = question.correctAnswers.includes(option.id);

                  let optionStyles = 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200';

                  if (isAnswered) {
                    if (isCorrectOption) {
                      optionStyles = 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 font-medium shadow-md shadow-emerald-900/20';
                    } else if (isSelected && !isCorrectOption) {
                      optionStyles = 'bg-rose-950/60 border-rose-500/80 text-rose-200 line-through opacity-80';
                    } else {
                      optionStyles = 'bg-slate-900/40 border-slate-800 text-slate-400 opacity-60';
                    }
                  } else if (isSelected) {
                    optionStyles = 'bg-blue-900/50 border-blue-500 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-500';
                  }

                  return (
                    <div
                      key={option.id}
                      onClick={() => handleSelectOption(option.id)}
                      className={`flex items-start p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${optionStyles}`}
                    >
                      <div className="flex-shrink-0 mr-3 mt-0.5">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs border ${
                          isSelected 
                            ? isAnswered 
                              ? isCorrectOption 
                                ? 'bg-emerald-500 text-white border-emerald-400' 
                                : 'bg-rose-500 text-white border-rose-400'
                              : 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}>
                          {option.id}
                        </div>
                      </div>
                      <div className="flex-1 text-sm sm:text-base leading-relaxed">
                        {option.text}
                      </div>
                      {isAnswered && isCorrectOption && (
                        <span className="flex-shrink-0 ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>正解</span>
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl text-slate-400 text-sm">
                  選択肢データがありません
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit or Next Button */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            {record?.totalAttempts ? (
              <span>これまでの演習: {record.totalAttempts}回 (正解: {record.correctCount}回 / 連続正解: {record.consecutiveCorrect}回)</span>
            ) : (
              <span>まだこの問題は演習していません</span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {!isAnswered ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!canSubmit}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer text-sm"
              >
                解答する
              </button>
            ) : (
              <button
                onClick={onNext}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition cursor-pointer text-sm flex items-center justify-center space-x-2"
              >
                <span>次の問題へ進む</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Instant Result & Explanation Section */}
        {isAnswered && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-fadeIn">
            {/* Feedback Banner */}
            <div className={`p-4 sm:p-5 rounded-xl border flex items-center justify-between ${
              isCurrentCorrect
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isCurrentCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {isCurrentCorrect ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg">
                    {isCurrentCorrect ? '正解です！お見事！' : '残念、不正解です...'}
                  </h4>
                  <p className="text-xs sm:text-sm opacity-90">
                    正解: <strong className="font-bold text-white underline decoration-cyan-400">{question.correctAnswers.join(' / ')}</strong>
                  </p>
                </div>
              </div>

              {/* Ping-t Badge Award notice */}
              <div className="hidden sm:block text-right shrink-0">
                {record?.medal === 'gold' && (
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>金メダル (完全習得)</span>
                  </span>
                )}
                {record?.medal === 'silver' && (
                  <span className="text-xs font-bold text-slate-300 bg-slate-500/10 px-3 py-1.5 rounded-lg border border-slate-500/30 flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>銀メダル獲得！あと1回で金！</span>
                  </span>
                )}
                {record?.medal === 'bronze' && isCurrentCorrect && (
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/30 flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>銅メダル獲得！</span>
                  </span>
                )}
              </div>
            </div>

            {/* Explanation Details Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm border-b border-slate-800 pb-2">
                <HelpCircle className="w-4 h-4" />
                <span>【詳細解説】</span>
              </div>

              <div className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                {question.explanation}
              </div>

              {/* Key points if present */}
              {question.keyPoints && question.keyPoints.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-slate-900 border border-cyan-900/50 space-y-2">
                  <div className="text-xs font-bold text-cyan-400 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>重要ポイント</span>
                  </div>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-slate-300 space-y-1">
                    {question.keyPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Personal User Note (Ping-t ユーザメモ機能) */}
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center space-x-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>自分用学習メモ (Ping-t ユーザメモ)</span>
                  </span>
                  {!isNoteEditing ? (
                    <button
                      onClick={() => setIsNoteEditing(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {noteText ? 'メモを編集' : 'メモを追加'}
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveUserNote}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  )}
                </div>

                {isNoteEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="覚書、間違えた理由、要点などを記録できます..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-sans"
                    />
                  </div>
                ) : noteText ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs sm:text-sm text-amber-200">
                    {noteText}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    メモは保存されていません
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Prev / Next Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>前の問題</span>
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalQuestions - 1}
          className="flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          <span>次の問題</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
