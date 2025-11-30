import React from 'react';
import { AlertTriangle, GraduationCap, LayoutGrid } from 'lucide-react';
import { ValidationResult } from '../types';

interface SearchSectionProps {
    university: string;
    setUniversity: (val: string) => void;
    department: string;
    setDepartment: (val: string) => void;
    onAnalyze: (e: React.FormEvent) => void;
    validationError: ValidationResult | null;
    setValidationError: (val: ValidationResult | null) => void;
    rateLimitError: string | null;
    setRateLimitError: (val: string | null) => void;
    onConfirmCorrection: () => void;
    onProceedAnyway: () => void;
}

const SearchSection: React.FC<SearchSectionProps> = ({
    university,
    setUniversity,
    department,
    setDepartment,
    onAnalyze,
    validationError,
    setValidationError,
    rateLimitError,
    setRateLimitError,
    onConfirmCorrection,
    onProceedAnyway,
}) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-700">

            <div className="text-center mb-12 space-y-6">
                <h2 className="text-4xl md:text-6xl font-serif-kr font-bold text-[#1e293b] leading-tight tracking-tight">
                    AI와 함께<br />
                    <span className="text-indigo-700">당신의 성공적인 편입을</span>
                </h2>
                <p className="text-lg md:text-xl text-slate-500 font-serif-kr font-light">
                    목표 대학과 학과를 입력하고,<br className="hidden md:block" />
                    맞춤형 면접 준비를 시작하세요.
                </p>
            </div>

            {/* Rate Limit Message */}
            {rateLimitError && (
                <div className="w-full max-w-2xl mb-8 bg-red-50 border border-red-200 rounded-xl p-6 text-left animate-in fade-in zoom-in-95 shadow-sm">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
                        <div className="flex-1 font-serif-kr">
                            <h3 className="font-bold text-red-900 text-lg mb-1">
                                요청 제한 초과
                            </h3>
                            <p className="text-red-800 mb-4">{rateLimitError}</p>
                            <button
                                onClick={() => setRateLimitError(null)}
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Message */}
            {validationError && (
                <div className="w-full max-w-2xl mb-8 bg-amber-50 border border-amber-200 rounded-xl p-6 text-left animate-in fade-in zoom-in-95 shadow-sm">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
                        <div className="flex-1 font-serif-kr">
                            <h3 className="font-bold text-amber-900 text-lg mb-1">
                                {validationError.isTypo ? "잠시만요, 오타가 있는 것 같아요!" : "정보를 찾을 수 없습니다."}
                            </h3>
                            <p className="text-amber-800 mb-4">{validationError.message}</p>

                            {validationError.isTypo && validationError.correctedUniversity && (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={onConfirmCorrection}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                                    >
                                        네, "{validationError.correctedUniversity} {validationError.correctedDepartment || department}"(으)로 검색할게요.
                                    </button>
                                    <button
                                        onClick={onProceedAnyway}
                                        className="px-4 py-2 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg font-medium transition-colors"
                                    >
                                        아니요, 그대로 진행할게요.
                                    </button>
                                </div>
                            )}

                            {!validationError.isTypo && !validationError.isValid && (
                                <button
                                    onClick={() => setValidationError(null)}
                                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium transition-colors"
                                >
                                    다시 입력하기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Search Form - Updated Horizontal Layout */}
            {!validationError && (
                <div className="w-full max-w-2xl space-y-6">
                    <form onSubmit={onAnalyze} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all flex items-center h-14">
                            <div className="pl-4 text-slate-400">
                                <GraduationCap className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                placeholder="대학교 (예: 연세대학교)"
                                className="w-full px-4 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-serif-kr"
                                value={university}
                                onChange={(e) => setUniversity(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all flex items-center h-14">
                            <div className="pl-4 text-slate-400">
                                <LayoutGrid className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                placeholder="학과 (예: 컴퓨터과학과)"
                                className="w-full px-4 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-serif-kr"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                required
                            />
                        </div>
                    </form>

                    <button
                        onClick={onAnalyze}
                        disabled={!university || !department}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 font-serif-kr tracking-wide"
                    >
                        시작하기
                    </button>

                </div>
            )}
        </div>
    );
};

export default SearchSection;
