
import React from 'react';
import { AnalysisStep, StepStatus } from '../types';
import { CheckCircle, CircleDashed, Loader2 } from 'lucide-react';

interface ProgressStepsProps {
  steps: AnalysisStep[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps }) => {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="flex items-center justify-between relative">
        {/* Connector Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full" />
        
        {steps.map((step, index) => {
          let Icon = CircleDashed;
          let colorClass = "bg-white text-slate-300 border-slate-200";
          let labelClass = "text-slate-300";

          if (step.status === StepStatus.COMPLETED) {
            Icon = CheckCircle;
            colorClass = "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200";
            labelClass = "text-indigo-700 font-bold";
          } else if (step.status === StepStatus.LOADING) {
            Icon = Loader2;
            colorClass = "bg-white text-indigo-600 border-indigo-600 shadow-lg ring-4 ring-indigo-50";
            labelClass = "text-indigo-600 font-bold";
          } else if (step.status === StepStatus.PAUSED) {
            colorClass = "bg-amber-50 text-amber-500 border-amber-500";
            labelClass = "text-amber-600";
          } else if (step.status === StepStatus.ERROR) {
            colorClass = "bg-red-50 text-red-600 border-red-600";
            labelClass = "text-red-600";
          } else {
             // IDLE
             labelClass = "text-slate-400";
          }

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${colorClass} z-10`}>
                <Icon className={`w-6 h-6 ${step.status === StepStatus.LOADING ? 'animate-spin' : ''}`} />
              </div>
              <span className={`mt-3 text-xs font-serif-kr tracking-wide ${labelClass} transition-colors duration-300`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressSteps;
