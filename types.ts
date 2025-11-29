
export interface ResearchSource {
  title: string;
  uri: string;
}

export interface ResearchResult {
  text: string;
  sources: ResearchSource[];
}

export interface Professor {
  name: string;
  lab?: string;
  contact?: string;
  majorPapers: string[];
  researchTendency: string; // "Based on papers, researches X..."
  details?: string;
}

export interface ProfessorAnalysisResult {
  professors: Professor[];
  majorKnowledgeAnalysis: string;
  sources: ResearchSource[];
}

export interface InterviewQuestion {
  question: string;
  intent: string; // Why this question is asked
  tip: string;    // How to answer
}

export interface CoreConcept {
  keyword: string;
  description: string;
  example: string;
}

export interface StrategicPlan {
  coreStrategy: string;
  coreConcepts: CoreConcept[]; // Updated from string[] to object array
  questions: {
    high: InterviewQuestion[];
    medium: InterviewQuestion[];
    low: InterviewQuestion[];
  };
}

export interface FullReport {
  university: string;
  department: string;
  curriculumAnalysis: ResearchResult; // Covers 1, 2
  professorAnalysis: ProfessorAnalysisResult; // Covers 3, 4
  interviewTrends: ResearchResult; // Covers 5, 6, 7, 8, 9
  strategy: StrategicPlan;
}

export enum StepStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  ERROR = 'error',
  PAUSED = 'paused', // Added PAUSED status
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: StepStatus;
}

export interface ValidationResult {
  isValid: boolean;
  correctedUniversity?: string;
  correctedDepartment?: string;
  message?: string;
  isTypo?: boolean;
}
