import React, { useState, useMemo } from 'react';
import { Search, X, Award, ChevronRight, Terminal, Filter } from 'lucide-react';
import { ALL_QUESTIONS, CATEGORIES } from '../data';
import { QuestionItem, UserProgressRecord, MedalStatus } from '../types/question';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: Record<string, UserProgressRecord>;
  onSelectQuestion: (question: QuestionItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  records,
  onSelectQuestion,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMedal, setSelectedMedal] = useState<string>('all');

  const filteredQuestions = useMemo(() => {
    if (!searchTerm.trim() && selectedCategory === 'all' && selectedMedal === 'all') {
      return ALL_QUESTIONS.slice(0, 30); // initial preview
    }

    const term = searchTerm.toLowerCase();

    return ALL_QUESTIONS.filter(q => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'Simulation') {
          if (q.type !== 'simulation' && !q.part.toLowerCase().includes('sim')) return false;
        } else if (!q.category.includes(selectedCategory)) {
          return false;
        }
      }

      // Medal filter
      if (selectedMedal !== 'all') {
        const rec = records[q.id];
        const currentMedal = rec?.medal || 'unanswered';
        if (currentMedal !== selectedMedal) return false;
      }

      // Search term
      if (term) {
        const matchText = q.questionText.toLowerCase().includes(term);
        const matchId = q.id.toLowerCase().includes(term);
        const matchExplanation = q.explanation.toLowerCase().includes(term);
        const matchCommands = q.commandOutputs?.toLowerCase().includes(term);
        const matchOptions = q.options?.some(o => o.text.toLowerCase().includes(term));
        const matchDiagram = q.diagramDescription?.toLowerCase().includes(term);

        if (!matchText && !matchId && !matchExplanation && !matchCommands && !matchOptions && !matchDiagram) {
          return false;
        }
      }

      return true;
    }).slice(0, 100); // limit to 100 for fast rendering
  }, [searchTerm, selectedCategory, selectedMedal, records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-12 sm:pt-20 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="用語、コマンド、問題文、解説を検索 (例: OSPF, VLAN, access-list, 802.1Q...)"
            className="flex-1 bg-transparent text-white text-base sm:text-lg focus:outline-none placeholder-slate-500 font-sans"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>絞り込み:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
          >
            <option value="all">全カテゴリ</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedMedal}
            onChange={(e) => setSelectedMedal(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
          >
            <option value="all">全メダル</option>
            <option value="unanswered">未出題のみ</option>
            <option value="bronze">銅メダルのみ</option>
            <option value="silver">銀メダルのみ</option>
            <option value="gold">金メダルのみ</option>
          </select>

          <span className="text-slate-500 ml-auto">
            該当: {filteredQuestions.length} 件
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              検索条件に一致する問題が見つかりませんでした
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const rec = records[q.id];
              const medal = rec?.medal || 'unanswered';

              return (
                <div
                  key={q.id}
                  onClick={() => {
                    onSelectQuestion(q);
                    onClose();
                  }}
                  className="bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/50 p-3.5 rounded-xl transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {q.id}
                      </span>
                      <span className="text-xs text-slate-400">{q.category}</span>
                      {q.type === 'simulation' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          CLI
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 line-clamp-1 group-hover:text-white transition-colors">
                      {q.questionText}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {medal === 'gold' && <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" title="金" />}
                    {medal === 'silver' && <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="銀" />}
                    {medal === 'bronze' && <span className="w-2.5 h-2.5 rounded-full bg-orange-400" title="銅" />}
                    {medal === 'unanswered' && <span className="w-2.5 h-2.5 rounded-full bg-slate-600" title="未" />}
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
