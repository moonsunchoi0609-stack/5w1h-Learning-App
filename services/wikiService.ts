import { Article } from '../types';

export const fetchWikipediaArticles = async (searchQuery: string): Promise<Article[]> => {
  // AI 생성 방식으로 변경되어 더 이상 위키백과 API를 직접 호출하지 않습니다.
  // 추후 필요 시 복구를 위해 인터페이스만 유지하거나 빈 배열을 반환합니다.
  console.warn("Wikipedia search is deprecated. Use AI generation instead.");
  return [];
};