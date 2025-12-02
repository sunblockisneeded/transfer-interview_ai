import { ResearchResult, StrategicPlan, ProfessorAnalysisResult, ValidationResult } from "../types";
import { logger } from "../utils/logger";

// Helper to make API calls
const apiCall = async (action: string, payload: any) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error(`API:${action}`, error);
    throw error;
  }
};

const logStep = (step: string, message: string) => {
  logger.log(step, `${new Date().toLocaleTimeString()} - ${message}`);
};

// --- Validation Function ---
export const validateUniversityAndDepartment = async (uni: string, dept: string): Promise<ValidationResult> => {
  try {
    return await apiCall('validate', { uni, dept });
  } catch (error) {
    return { isValid: true, isTypo: false, message: "Validation skipped due to error." };
  }
};

// --- Research Functions ---

export const researchCurriculum = async (uni: string, dept: string, config?: { timeout: number, model: string }): Promise<ResearchResult> => {
  logStep('Curriculum', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('curriculum', { uni, dept, config });
    logStep('Curriculum', `Completed`);
    return result;
  } catch (error) {
    logStep('Curriculum', 'Error occurred');
    return { text: "분석 데이터를 가져오는 데 실패했습니다.", sources: [] };
  }
};

export const researchProfessorsAndKnowledge = async (uni: string, dept: string, config?: { timeout: number, model: string }): Promise<ProfessorAnalysisResult> => {
  logStep('Professors', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('professors', { uni, dept, config });
    logStep('Professors', `Completed`);
    return result;
  } catch (error) {
    logStep('Professors', `Error: ${error}`);
    return { professors: [], majorKnowledgeAnalysis: "정보를 찾을 수 없습니다.", sources: [] };
  }
};

export const researchInterviewTrends = async (uni: string, dept: string, config?: { timeout: number, model: string }): Promise<ResearchResult> => {
  logStep('Trends', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('trends', { uni, dept, config });
    logStep('Trends', `Completed`);
    return result;
  } catch (error) {
    logStep('Trends', `Error: ${error}`);
    return { text: "데이터를 가져오는 데 실패했습니다.", sources: [] };
  }
};

export const synthesizeStrategyOnly = async (
  uni: string,
  dept: string,
  curriculum: string,
  professors: any[],
  trends: string,
  config?: { timeout: number, model: string }
): Promise<any> => {
  logStep('Synthesis', `Starting strategy generation`);
  try {
    const result = await apiCall('synthesis', { uni, dept, curriculum, professors, trends, config, subTask: 'strategy' });
    logStep('Synthesis', `Strategy Completed`);
    return result;
  } catch (error) {
    logStep('Synthesis', `Strategy Error: ${error}`);
    return { coreStrategy: "전략 생성 실패", coreConcepts: [] };
  }
};

export const synthesizeQuestionsOnly = async (
  uni: string,
  dept: string,
  curriculum: string,
  professors: any[],
  trends: string,
  config?: { timeout: number, model: string }
): Promise<any> => {
  logStep('Synthesis', `Starting question generation`);
  try {
    const result = await apiCall('synthesis', { uni, dept, curriculum, professors, trends, config, subTask: 'questions' });
    logStep('Synthesis', `Questions Completed`);
    return result;
  } catch (error) {
    logStep('Synthesis', `Questions Error: ${error}`);
    return { questions: { high: [], medium: [], low: [] } };
  }
};

// Legacy support or full call if needed
export const synthesizeStrategy = async (
  uni: string,
  dept: string,
  curriculum: string,
  professors: any[],
  trends: string,
  abortSignal?: AbortSignal,
  config?: { timeout: number, model: string }
): Promise<StrategicPlan> => {
  // This function is kept for backward compatibility but might not be used if App.tsx switches to split calls.
  // For now, let's implement it using the split calls to ensure consistency if called.

  const [strategy, questions] = await Promise.all([
    synthesizeStrategyOnly(uni, dept, curriculum, professors, trends, config),
    synthesizeQuestionsOnly(uni, dept, curriculum, professors, trends, config)
  ]);

  return {
    ...strategy,
    ...questions
  };
};

export const auditResearch = async (
  uni: string,
  dept: string,
  curriculum: ResearchResult,
  professors: ProfessorAnalysisResult,
  trends: ResearchResult,
  config?: { timeout: number, model: string }
): Promise<any> => {
  logStep('Audit', `Starting independent audit for ${uni} ${dept}`);
  try {
    const result = await apiCall('audit', { uni, dept, curriculum, professors, trends, config });
    logStep('Audit', `Completed with score: ${result.score}`);
    return result;
  } catch (error) {
    logStep('Audit', `Error: ${error}`);
    return { score: 0, status: "WARNING", issues: ["Audit failed"], feedback: "Proceed with caution." };
  }
};
