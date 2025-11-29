
import React from 'react';
import { StrategicPlan, InterviewQuestion } from '../types';
import { ShieldAlert, HelpCircle, CheckCircle2 } from 'lucide-react';

interface QuestionsViewProps {
  strategy: StrategicPlan;
}

const QuestionCard: React.FC<{ question: InterviewQuestion; index: number; type: 'High' | 'Medium' | 'Low' }> = ({ question, index, type }) => {
  const badgeColors = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-green-50 text-green-700 border-green-200"
  };

  const iconMap = {
    High: <ShieldAlert className="w-4 h-4 text-red-600" />,
    Medium: <HelpCircle className="w-4 h-4 text-amber-600" />,
    Low: <CheckCircle2 className="w-4 h-4 text-green-600" />
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide flex items-center gap-1.5 font-sans ${badgeColors[type]}`}>
          {iconMap[type]}
          {type}
        </span>
        <span className="text-slate-300 font-serif-kr text-sm italic">Q {index + 1}</span>
      </div>
      
      <h3 className="text-lg font-bold text-[#1e293b] mb-4 leading-relaxed font-serif-kr">
        "{question.question}"
      </h3>
      
      <div className="space-y-4 font-serif-kr">
        <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <strong className="text-slate-900 block mb-1 text-xs uppercase tracking-wider font-sans">Intent</strong>
          {question.intent}
        </div>
        <div className="text-sm bg-[#eef2ff] p-4 rounded-lg text-indigo-900 border border-indigo-100">
          <strong className="text-indigo-700 block mb-1 text-xs uppercase tracking-wider font-sans">Pro Tip</strong>
          {question.tip}
        </div>
      </div>
    </div>
  );
};

const QuestionsView: React.FC<QuestionsViewProps> = ({ strategy }) => {
  const renderQuestions = (questions: InterviewQuestion[] | undefined, type: 'High' | 'Medium' | 'Low', title: string, colorClass: string, borderColorClass: string) => {
    return (
      <div className={`bg-white p-8 rounded-xl border border-l-4 ${borderColorClass} border-y-slate-200 border-r-slate-200 shadow-sm`}>
        <h3 className={`text-xl font-bold ${colorClass} mb-8 flex items-center gap-2 font-serif-kr`}>
          {title}
        </h3>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {questions && questions.length > 0 ? (
            questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i} type={type} />
            ))
          ) : (
            <p className="text-slate-500 italic font-serif-kr">질문이 생성되지 않았습니다.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 font-serif-kr">
      {renderQuestions(strategy.questions?.high, 'High', '심화 전공 & 문제 해결 (High Difficulty)', 'text-red-800', 'border-l-red-600')}
      {renderQuestions(strategy.questions?.medium, 'Medium', '핵심 개념 & 응용 (Medium Difficulty)', 'text-amber-800', 'border-l-amber-500')}
      {renderQuestions(strategy.questions?.low, 'Low', '기초 & 인성 (Low Difficulty)', 'text-green-800', 'border-l-green-600')}
    </div>
  );
};

export default QuestionsView;
