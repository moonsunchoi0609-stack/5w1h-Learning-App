import { GoogleGenAI, Type } from "@google/genai";
import { Article, Difficulty, AnalysisResult } from "../types";

// Lazy Initialization of Gemini Client
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing. Please check your environment variables.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const modelName = 'gemini-2.5-flash';

// Helper to handle markdown code blocks in JSON response
const parseResponse = (text: string) => {
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("JSON Parse Error:", error);
    console.error("Raw Text:", text);
    throw new Error("Failed to parse AI response");
  }
};

export const analyzeArticleWithAI = async (articleText: string): Promise<AnalysisResult> => {
  try {
    const client = getAiClient();
    const prompt = `
      다음 텍스트를 분석하여 육하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)에 해당하는 내용을 추출하세요.
      
      [요구사항]
      1. 'answers': 각 항목에 대한 요약 답변을 한국어로 작성하세요. 초등학교 고학년이 이해하기 쉬운 1~2문장으로 작성하세요.
      2. 'quotes': 'answers'를 도출하는 데 결정적인 근거가 된 본문의 문구(단어 또는 문장 일부)를 그대로 발췌하여 리스트로 만드세요. 
         - 본문에 있는 텍스트와 **정확히 일치**해야 하이라이팅이 가능합니다.
         - 근거가 여러 군데라면 여러 개를 담으세요.
      3. 명시되지 않은 정보는 문맥을 통해 합리적으로 추론하거나, 전혀 알 수 없는 경우 '알 수 없음'으로 표시하고 quotes는 빈 배열로 두세요.

      분석할 텍스트:
      ${articleText.substring(0, 5000)}
    `;

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answers: {
              type: Type.OBJECT,
              properties: {
                who: { type: Type.STRING },
                when: { type: Type.STRING },
                where: { type: Type.STRING },
                what: { type: Type.STRING },
                how: { type: Type.STRING },
                why: { type: Type.STRING },
              },
              required: ["who", "when", "where", "what", "how", "why"],
            },
            quotes: {
              type: Type.OBJECT,
              properties: {
                who: { type: Type.ARRAY, items: { type: Type.STRING } },
                when: { type: Type.ARRAY, items: { type: Type.STRING } },
                where: { type: Type.ARRAY, items: { type: Type.STRING } },
                what: { type: Type.ARRAY, items: { type: Type.STRING } },
                how: { type: Type.ARRAY, items: { type: Type.STRING } },
                why: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["who", "when", "where", "what", "how", "why"],
            }
          },
          required: ["answers", "quotes"],
        },
      },
    });

    if (response.text) {
      return parseResponse(response.text) as AnalysisResult;
    }
    throw new Error("No response text from AI");
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};

export const refineTextForW1H = async (text: string): Promise<string> => {
  // 하위 호환성을 위해 유지
  return text;
};

export const generateEducationalArticle = async (topic: string, difficulty: Difficulty = 'medium'): Promise<Article> => {
  let targetAudience = "초등학교 고학년";
  let writingStyle = "명확한 문장 구조와 표준적인 어휘";
  
  if (difficulty === 'easy') {
    targetAudience = "초등학교 저학년(1~3학년)";
    writingStyle = "아주 쉬운 어휘, 짧은 문장, 친근한 동화체";
  } else if (difficulty === 'hard') {
    targetAudience = "중학생";
    writingStyle = "논리적인 전개, 구체적인 설명, 다소 심화된 어휘 사용";
  }

  try {
    const client = getAiClient();
    const prompt = `
      '${topic}'에 대해 ${targetAudience} 학생들이 읽고 육하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)을 분석하기 좋은 교육용 지문을 작성해주세요.

      [작성 가이드]
      1. 대상 독자 및 난이도: ${targetAudience} 수준. (${writingStyle})
      2. 구성 방식 (핵심):
         - **절대로** '언제: O월 O일', '장소: OO' 처럼 정보를 요약하거나 나열하지 마세요.
         - 사건이 일어난 순서나 인과 관계에 따라 자연스러운 줄글(이야기) 형태로 서술하세요.
         - 학생이 글을 꼼꼼히 읽어야만 육하원칙 요소를 발견할 수 있도록 문맥 속에 정보를 자연스럽게 녹여내세요.
      3. 내용 보강: 원문의 정보가 빈약하다면 사실관계를 해치지 않는 선에서 상황을 이해할 수 있는 배경 설명이나 묘사를 1~2문장 추가하세요.
      4. 어조: 친절하고 차분한 설명조('~합니다/했습니다')를 유지하세요.
      5. 형식:
         - 제목: 주제를 잘 나타내는 매력적인 제목
         - 카테고리: 주제에 맞는 적절한 분야 (예: 역사, 과학, 사회, 인물 등)
         - 분량: 500~800자 내외

      응답은 반드시 JSON 형식을 준수하세요. Markdown 코드 블록 없이 순수 JSON만 반환하면 더 좋습니다.
    `;

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "category", "content"],
        },
      },
    });

    if (response.text) {
      const data = parseResponse(response.text);
      return {
        id: `gen_${Date.now()}`,
        title: data.title,
        category: data.category,
        content: data.content,
        source: 'AI 생성 활동지',
        readTime: difficulty === 'easy' ? '쉬움' : difficulty === 'hard' ? '어려움' : '보통',
        keywords: [topic, 'AI작문']
      };
    }
    throw new Error("No text generated");
  } catch (error) {
    console.error("Article generation failed:", error);
    throw error;
  }
};

export const getRecommendedKeywords = async (): Promise<string[]> => {
  try {
    const client = getAiClient();
    const response = await client.models.generateContent({
      model: modelName,
      contents: `초등학생이 탐구 학습 주제로 삼기 좋은 흥미로운 검색 키워드 6가지를 추천해주세요.
      역사, 과학, 사회, 시사, 인물 등 다양한 분야에서 랜덤하게 선정하여 매번 새로운 느낌을 주도록 하세요.
      너무 뻔한 단어보다는 호기심을 자극하는 구체적인 소재가 좋습니다.
      
      결과는 오직 JSON 문자열 배열 포맷(["키워드1", "키워드2", ...])으로만 출력하세요.`,
      config: {
        responseMimeType: "application/json",
         responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    if (response.text) {
      const keywords = parseResponse(response.text);
      if (Array.isArray(keywords)) return keywords;
    }
    return [];
  } catch (e) {
    console.error("Failed to fetch keywords", e);
    return [];
  }
};