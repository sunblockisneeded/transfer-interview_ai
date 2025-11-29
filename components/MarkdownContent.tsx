
import React from 'react';
import SourceList from './SourceList';
import { ResearchSource } from '../types';

interface MarkdownContentProps {
  content: string;
  sources?: ResearchSource[];
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, sources }) => {
  // Extract number from header text to generate ID (e.g., "# 1. Analysis" -> id="section-1")
  const getHeaderId = (text: string) => {
    // Handle "# 1." or "# 1" formats
    const match = text.match(/^#+\s*(\d+)/);
    if (match) {
      return `section-${match[1]}`;
    }
    return undefined;
  };

  const renderLine = (line: string, index: number) => {
    // Clean string for display
    const cleanText = (str: string) => str.replace(/^#+\s*/, '');

    // Headers with automatic IDs for TOC - Using Serif Fonts
    if (line.startsWith('# ')) {
      const id = getHeaderId(line);
      return <h1 key={index} id={id} className="text-3xl font-bold font-serif-kr text-[#1e293b] mt-10 mb-6 scroll-mt-32 pb-3 border-b border-slate-300">{cleanText(line)}</h1>;
    }
    if (line.startsWith('## ')) {
      const id = getHeaderId(line); 
      return <h2 key={index} id={id} className="text-2xl font-bold font-serif-kr text-[#334155] mt-8 mb-4 scroll-mt-32">{cleanText(line)}</h2>;
    }
    if (line.startsWith('### ')) {
       return <h3 key={index} className="text-xl font-bold font-serif-kr text-[#475569] mt-6 mb-3">{cleanText(line)}</h3>;
    }
    if (line.startsWith('#### ')) {
       return <h4 key={index} className="text-lg font-bold font-serif-kr text-[#475569] mt-4 mb-2">{cleanText(line)}</h4>;
    }

    // Lists
    if (line.trim().startsWith('- ')) {
      return (
        <li key={index} className="ml-4 list-disc text-slate-700 mb-2 pl-1 font-serif-kr leading-relaxed">
          {parseInline(line.trim().substring(2))}
        </li>
      );
    }
    
    // Normal Paragraph
    if (line.trim() === '') return <div key={index} className="h-4" />;

    return <p key={index} className="text-slate-700 leading-8 mb-4 font-serif-kr">{parseInline(line)}</p>;
  };

  // Helper to parse bold syntax **text**
  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <div className="prose prose-slate max-w-none prose-p:font-serif-kr prose-headings:font-serif-kr">
        {content.split('\n').map((line, i) => renderLine(line, i))}
      </div>
      {sources && <SourceList sources={sources} />}
    </div>
  );
};

export default MarkdownContent;
