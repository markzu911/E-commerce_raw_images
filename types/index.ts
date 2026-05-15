export interface AnalysisData {
  productName: string;
  category: string;
  style: string;
  colors: string[];
  materials: string;
  season: string;
  description: string;
  sellingPoints: string[];
  targetAudience: string;
  keywords: string[];
  modelStyle: string;
  sceneStyle: string;
  brandName: string;
  posterTheme: string;
}

export interface PromptConfig {
  garmentCategory: string;
  garmentColor: string;
  garmentMaterial: string;
  garmentStyle: string;
  modelStyle: string;
  sceneStyle: string;
  sellingPoint1: string;
  sellingPoint2: string;
  sellingPoint3: string;
  brandName: string;
  sceneTheme: string;
}

export interface TextOverlayConfig {
  mainTitle: string;
  subTitle: string;
  price: string;
  promoBadge: string;
  detailInfo: string[];
  sellingPointTexts: string[];
  sceneTitle: string;
  sceneSubtitle: string;
}

export type Step = 'upload' | 'select' | 'analyzing' | 'result' | 'generating' | 'done';
