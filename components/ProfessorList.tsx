
import React, { useState } from 'react';
import { Professor, ResearchSource } from '../types';
import SourceList from './SourceList';
import { User, ChevronDown, ChevronUp, BookOpen, FlaskConical } from 'lucide-react';

interface ProfessorListProps {
  professors: Professor[];
  sources: ResearchSource[];
}

const ProfessorCard: React.FC<{ professor: Professor }> = ({ professor }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all font-serif-kr">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
            <User className="w-7 h-7 text-slate-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1e293b] mb-1">{professor.name}</h3>
            {professor.lab && <p className="text-sm text-slate-600 font-medium mb-1">{professor.lab}</p>}
            {professor.contact && <p className="text-xs text-slate-400 font-sans">{professor.contact}</p>}
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Research Tendency Summary */}
      <div className="mt-5 bg-[#f8fafc] p-4 rounded-lg border border-slate-100">
        <div className="flex items-start gap-3">
          <FlaskConical className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />
          <p className="text-sm text-slate-700 italic leading-relaxed">
            "{professor.researchTendency || "연구 성향 분석 중..."}"
          </p>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 font-sans">
              <BookOpen className="w-3 h-3" /> Recent Papers
            </h4>
            <ul className="space-y-3">
              {professor.majorPapers?.length > 0 ? (
                professor.majorPapers.map((paper, idx) => (
                  <li key={idx} className="text-sm text-slate-700 pl-4 border-l-2 border-indigo-100 leading-relaxed">
                    {paper}
                  </li>
                ))
              ) : (
                 <li className="text-sm text-slate-400 pl-3 border-l-2 border-slate-200">논문 정보 없음</li>
              )}
            </ul>
          </div>
          {professor.details && (
            <p className="text-sm text-slate-500 mt-3 leading-relaxed bg-slate-50 p-3 rounded">{professor.details}</p>
          )}
        </div>
      )}
    </div>
  );
};

const ProfessorList: React.FC<ProfessorListProps> = ({ professors, sources }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {professors && professors.length > 0 ? (
          professors.map((prof, index) => (
            <ProfessorCard key={index} professor={prof} />
          ))
        ) : (
          <div className="col-span-full text-center text-slate-500 p-10 bg-slate-50 rounded-lg italic font-serif-kr">
            교수진 정보를 찾을 수 없습니다.
          </div>
        )}
      </div>
      <SourceList sources={sources} />
    </div>
  );
};

export default ProfessorList;
