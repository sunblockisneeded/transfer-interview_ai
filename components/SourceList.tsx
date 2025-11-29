import React from 'react';
import { ResearchSource } from '../types';

interface SourceListProps {
  sources: ResearchSource[];
}

const SourceList: React.FC<SourceListProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-slate-200">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Sources & References
      </h4>
      <ul className="space-y-2">
        {sources.slice(0, 5).map((source, index) => (
          <li key={index} className="flex items-start">
            <span className="flex-shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center bg-slate-100 text-[10px] text-slate-500 rounded-full mr-2">
              {index + 1}
            </span>
            <a 
              href={source.uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all"
            >
              {source.title || source.uri}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SourceList;