import React from 'react';
import { StrategicPlan, InterviewQuestion } from '../types';
import { Brain, Target, ShieldAlert, Award } from 'lucide-react';

interface StrategyViewProps {
  strategy: StrategicPlan;
}

const QuestionCard: React.FC<{ question: InterviewQuestion; index: number; type: 'High' | 'Medium' | 'Low' }> = ({ question, index, type }) => {
  const badgeColors = {
    High: "bg-red-100 text-red-700 border-red-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-green-100 text-green-700 border-green-200"
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wide ${badgeColors[type]}`}>
          {type} Difficulty
        </span>
        <span className="text-slate-400 text-xs">Q{index + 1}</span>
      </div>
      <h3 className="text-lg font-medium text-slate-800 mb-2">"{question.question}"</h3>
      <div className="text-sm text-slate-600 mb-2">
        <strong className="text-slate-900">Intent:</strong> {question.intent}
      </div>
      <div className="text-sm bg-slate-50 p-2 rounded text-slate-600 border border-slate-100 italic">
        <strong className="text-indigo-600 not-italic">💡 Tip:</strong> {question.tip}
      </div>
    </div>
  );
};

const StrategyView: React.FC<StrategyViewProps> = ({ strategy }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Core Strategy Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-indigo-900">Strategic Overview</h2>
        </div>
        <p className="text-slate-700 leading-relaxed text-lg">
          {strategy.coreStrategy}
        </p>
      </div>

      {/* Core Concepts */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-slate-900">5 Key Concepts to Master</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {strategy.coreConcepts.map((concept, idx) => (
            <div key={idx} className="flex items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                {idx + 1}
              </span>
              <div className="flex flex-col">
                <span className="text-slate-800 font-medium">{concept.keyword}</span>
                <span className="text-slate-500 text-xs mt-1">{concept.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Questions Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" />
          Predicted Interview Questions
        </h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> High Difficulty (Deep Knowledge)
            </h3>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              {strategy.questions.high.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} type="High" />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-amber-600 mb-4">Medium Difficulty (Core Application)</h3>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              {strategy.questions.medium.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} type="Medium" />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-4">Low Difficulty (Basics & Fit)</h3>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              {strategy.questions.low.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} type="Low" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyView;