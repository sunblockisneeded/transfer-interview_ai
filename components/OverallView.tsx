
import React, { useState } from 'react';
import { StrategicPlan, CoreConcept } from '../types';
import { Target, Brain, Lightbulb, ArrowRightCircle } from 'lucide-react';

interface OverallViewProps {
  strategy: StrategicPlan;
}

const CoreConceptCard: React.FC<{ concept: CoreConcept; index: number }> = ({ concept, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer ${isOpen
        ? 'bg-[#f8fafc] border-indigo-200 shadow-md col-span-1 md:col-span-2 lg:col-span-1'
        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/10'
        }`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="p-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-serif-kr shadow-sm transition-colors ${isOpen ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-100'
            }`}>
            {index + 1}
          </span>
          <span className={`font-bold text-lg font-serif-kr ${isOpen ? 'text-indigo-900' : 'text-slate-800'}`}>
            {concept.keyword}
          </span>
        </div>
        <ArrowRightCircle className={`w-5 h-5 text-indigo-300 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-600' : 'rotate-0'}`} />
      </div>

      {/* Expandable Content */}
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 p-5 pt-0' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="mt-2 space-y-4 text-sm font-serif-kr">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-slate-700 leading-relaxed">
              {concept.description}
            </p>
          </div>
          <div className="flex items-start gap-3 text-indigo-800 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-600" />
            <div>
              <span className="font-bold text-xs uppercase tracking-wider block mb-1 text-indigo-500">Example Case</span>
              <p className="italic font-medium">"{concept.example}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OverallView: React.FC<OverallViewProps> = ({ strategy }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-serif-kr">

      {/* Strategy Summary */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-0 opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
              <Target className="w-6 h-6 text-indigo-700" />
            </div>
            <h2 className="text-2xl font-bold text-[#1e293b]">종합 면접 준비 전략</h2>
          </div>

          <div className="bg-white/50 rounded-lg">
            <p className="whitespace-pre-wrap leading-relaxed text-slate-800 font-medium text-lg font-serif-kr">
              {strategy.coreStrategy}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Core Concepts */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
            <Brain className="w-6 h-6 text-purple-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#1e293b]">핵심 마스터 키워드 (Top 5)</h2>
            <p className="text-sm text-slate-500 mt-1">키워드를 클릭하여 상세 설명과 예시를 확인하세요.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start">
          {strategy.coreConcepts && strategy.coreConcepts.length > 0 ? (
            strategy.coreConcepts.map((concept, idx) => (
              <CoreConceptCard key={idx} concept={concept} index={idx} />
            ))
          ) : (
            <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-lg italic">
              키워드를 분석하지 못했습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverallView;
