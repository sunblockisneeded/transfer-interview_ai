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

export const researchCurriculum = async (uni: string, dept: string): Promise<ResearchResult> => {
  logStep('Curriculum', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('curriculum', { uni, dept });
    logStep('Curriculum', `Completed`);
    return result;
  } catch (error) {
    logStep('Curriculum', 'Error occurred');
    return { text: "분석 데이터를 가져오는 데 실패했습니다.", sources: [] };
  }
};

export const researchProfessorsAndKnowledge = async (uni: string, dept: string): Promise<ProfessorAnalysisResult> => {
  logStep('Professors', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('professors', { uni, dept });
    logStep('Professors', `Completed`);
    return result;
  } catch (error) {
    logStep('Professors', `Error: ${error}`);
    return { professors: [], majorKnowledgeAnalysis: "정보를 찾을 수 없습니다.", sources: [] };
  }
};

export const researchInterviewTrends = async (uni: string, dept: string): Promise<ResearchResult> => {
  logStep('Trends', `Starting analysis for ${uni} ${dept}`);
  try {
    const result = await apiCall('trends', { uni, dept });
    logStep('Trends', `Completed`);
    return result;
  } catch (error) {
    logStep('Trends', `Error: ${error}`);
    return { text: "데이터를 가져오는 데 실패했습니다.", sources: [] };
  }
};

export const synthesizeStrategy = async (
  uni: string,
  dept: string,
  curriculum: string,
  professors: any[],
  trends: string,
  abortSignal?: AbortSignal
): Promise<StrategicPlan> => {
  logStep('Synthesis', `Starting strategy synthesis`);

  try {
    // Note: AbortSignal is not easily passed through simple fetch wrappers without more logic, 
    // but for now we'll just call the API.
    const result = await apiCall('synthesis', { uni, dept, curriculum, professors, trends });
    logStep('Synthesis', `Completed`);
    return result;
  } catch (error) {
    logStep('Synthesis', `Error: ${error}`);
    return {
      coreStrategy: "전략 생성에 실패했습니다. (서버 오류)",
      coreConcepts: [],
      questions: { high: [], medium: [], low: [] }
    };
  }
};
