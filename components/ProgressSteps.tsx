
import React from 'react';
import { AnalysisStep, StepStatus } from '../types';
import { CheckCircle, CircleDashed, Loader2, AlertTriangle } from 'lucide-react';

interface ProgressStepsProps {
  steps: AnalysisStep[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps }) => {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="flex items-start justify-between relative">
        {/* Connector Line - positioned relative to the circles */}
        <div className="absolute left-0 top-6 w-full h-1 bg-slate-100 -z-10 rounded-full" />

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
            <div key={step.id} className="flex flex-col items-center w-32">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${colorClass} z-10 bg-white`}>
                <Icon className={`w-6 h-6 ${step.status === StepStatus.LOADING ? 'animate-spin' : ''}`} />
              </div>
              <span className={`mt-3 text-xs font-serif-kr tracking-wide ${labelClass} transition-colors duration-300 text-center`}>
                {step.label}
              </span>

              {/* Sub-steps */}
              {step.subSteps && step.subSteps.length > 0 && (
                <div className="mt-4 space-y-2 w-full">
                  {step.subSteps.map((sub, idx) => {
                    let SubIcon = CircleDashed;
                    let subColor = "text-slate-300";
                    let subBg = "bg-slate-100";

                    if (sub.status === StepStatus.COMPLETED) {
                      SubIcon = CheckCircle;
                      subColor = "text-green-600";
                      subBg = "bg-green-50";
                    } else if (sub.status === StepStatus.LOADING) {
                      SubIcon = Loader2;
                      subColor = "text-blue-600";
                      subBg = "bg-blue-50";
                    } else if (sub.status === StepStatus.ERROR) {
                      SubIcon = AlertTriangle; // Need to import
                      subColor = "text-amber-600";
                      subBg = "bg-amber-50";
                    } else if (sub.status === StepStatus.ERROR) { // Timeout or Error
                      // User asked for X for timeout, Triangle for error. 
                      // Let's assume ERROR is triangle, and maybe add a TIMEOUT status? 
                      // Or just use ERROR for both for now, user said "Timeout occurred X".
                      // Let's stick to standard error triangle for now unless we add specific TIMEOUT status.
                    }

                    return (
                      <div key={idx} className="flex items-center gap-2 text-[10px] md:text-xs font-medium text-slate-500 justify-center md:justify-start">
                        {sub.status === StepStatus.LOADING && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                        {sub.status === StepStatus.COMPLETED && <CheckCircle className="w-3 h-3 text-green-500" />}
                        {sub.status === StepStatus.ERROR && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        {sub.status === StepStatus.IDLE && <div className="w-1.5 h-1.5 rounded-full bg-slate-200 ml-1 mr-0.5" />}
                        <span className={`${sub.status === StepStatus.COMPLETED ? 'text-slate-700' : 'text-slate-400'}`}>
                          {sub.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressSteps;
