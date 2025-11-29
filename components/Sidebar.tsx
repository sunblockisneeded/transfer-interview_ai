import React from 'react';
import { Sparkles, GraduationCap, RotateCcw, Download } from 'lucide-react';
import { FullReport } from '../types';

interface SidebarProps {
    university: string;
    department: string;
    report: FullReport | null;
    onReset: () => void;
    onDownload: () => void;
    onScrollToTop: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    university,
    department,
    report,
    onReset,
    onDownload,
    onScrollToTop,
}) => {
    return (
        <aside className="w-64 bg-[#0f172a] text-white flex-col hidden md:flex h-screen sticky top-0 font-sans shadow-xl z-20">
            <div className="p-6 border-b border-slate-800/50">
                <div onClick={onScrollToTop} className="flex items-center gap-3 cursor-pointer group">
                    <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50">
                        <Sparkles className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-bold font-playfair tracking-tight text-slate-100">
                        TransferPrep AI
                    </h1>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 mt-4">Menu</div>
                <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 text-sm font-medium hover:bg-indigo-500 transition-colors">
                    <GraduationCap className="w-5 h-5" />
                    New Prep
                </button>
            </nav>

            {/* Action Buttons in Sidebar */}
            {(university || department || report) && (
                <div className="p-4 border-t border-slate-800/50 space-y-3">
                    <button
                        onClick={onReset}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        초기화면으로
                    </button>
                    {report && (
                        <button
                            onClick={onDownload}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors text-sm"
                        >
                            <Download className="w-4 h-4" />
                            보고서 다운로드
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
