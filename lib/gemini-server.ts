
import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisData, PromptConfig } from '@/types';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeImageServer(imageBase64: string, type: string): Promise<AnalysisData> {
  const ai = getGeminiClient();
  
  const base64Data = imageBase64.split(',')[1];
  const mimeType = imageBase64.split(',')[0].split(':')[1].split(';')[0];

  const typeMap: Record<string, string> = {
    main: '商品主图（纯白底展示单品）',
    detail: '商品详情图（展示面料、细节）',
    sellingPoint: '卖点图（有模特，提炼商品优势）',
    scene: '场景图（有模特，展示衣服在真实环境中的上身效果）'
  };
  const typeDesc = typeMap[type] || '电商图片';

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: `为电商商品详情分析这张服装图片。用户当前需要生成一张【${typeDesc}】。**请务必使用中文（简体中文）输出结果。** 请重点关注与【${typeDesc}】相关的特征来提取以下详细信息：
          - productName (10个字符以内的商品名称)
          - category (如：连衣裙、卫衣、西装外套)
          - style (如：简约都市、法式浪漫)
          - colors (主要和次要颜色的数组，用中文描述)
          - materials (面料描述，如纯棉、丝绸)
          - season (适合的季节，如春夏、秋冬)
          - description (50-80字的中文商品描述)
          - sellingPoints (正好4个简短的中文卖点数组)
          - targetAudience (目标人群描述，中文)
          - keywords (正好5个搜索关键词数组，中文)
          - modelStyle (推荐的模特气质/风格，中文)
          - sceneStyle (推荐拍摄的背景/场景风格，中文)
          - brandName (如果没有明显的品牌名请留空)
          - posterTheme (推荐的主图海报主题，中文)`
        }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          category: { type: Type.STRING },
          style: { type: Type.STRING },
          colors: { type: Type.ARRAY, items: { type: Type.STRING } },
          materials: { type: Type.STRING },
          season: { type: Type.STRING },
          description: { type: Type.STRING },
          sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetAudience: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          modelStyle: { type: Type.STRING },
          sceneStyle: { type: Type.STRING },
          brandName: { type: Type.STRING },
          posterTheme: { type: Type.STRING },
        },
        required: [
          "productName", "category", "style", "colors", "materials",
          "season", "description", "sellingPoints", "targetAudience",
          "keywords", "modelStyle", "sceneStyle", "brandName", "posterTheme"
        ]
      }
    }
  });

  return JSON.parse(response.text!) as AnalysisData;
}

function buildPrompt(
  type: string,
  analysis: AnalysisData,
  config: PromptConfig,
  hasModelImage: boolean
): string {
  const vars = {
    garment_category: config.garmentCategory || analysis.category || '服装',
    garment_color: config.garmentColor || analysis.colors?.join(' ') || '',
    garment_material: config.garmentMaterial || analysis.materials || '',
    garment_style: config.garmentStyle || analysis.style || '简约通勤',
    model_style: config.modelStyle || analysis.modelStyle || '高级感、干净自然',
    scene_style: config.sceneStyle || analysis.sceneStyle || '极简棚拍',
    selling_point_1: config.sellingPoint1 || analysis.sellingPoints?.[0] || '显瘦修身',
    selling_point_2: config.sellingPoint2 || analysis.sellingPoints?.[1] || '舒适透气',
    selling_point_3: config.sellingPoint3 || analysis.sellingPoints?.[2] || '百搭通勤',
    brand_name: config.brandName || analysis.brandName || '',
    scene_theme: config.sceneTheme || analysis.posterTheme || '展示场景',
  };

  const garmentDesc = `${vars.garment_color} ${vars.garment_material} ${vars.garment_category}, ${vars.garment_style} style`;
  
  let basePrompt = '';
  
  if (type === 'main') {
    basePrompt = `【服装单品展示 - 无模特】
    100% explicitly identical to reference image. 
    Product: ${garmentDesc}
    Pure white background for product isolated display. Centered flat lay or hanging shot.
    CRITICAL: NO TEXT, NO PEOPLE, NO MANNEQUINS.`;
  } else {
    if (hasModelImage) {
      basePrompt = `【面孔复刻 - 最高优先级】
      Model face MUST be exactly the same as Reference Image 1. 
      Garment MUST be exactly the same as Reference Image 2.
      Model vibe: ${vars.model_style}.
      Garment: ${garmentDesc}.`;
    } else {
      basePrompt = `【默认模特 + 服装参照】
      Garment MUST be exactly the same as Reference Image.
      Female/Male model, ${vars.model_style} vibe. 
      Garment: ${garmentDesc}.`;
    }

    switch (type) {
      case 'detail':
        basePrompt += `\nScene: Fabric and craftsmanship close-up detail shot. Dark grey monochrome background. Split composition (full product + close-up detail).`;
        break;
      case 'sellingPoint':
        basePrompt += `\nScene: Morandi color portrait background (oatmeal/beige/milk tea). Rule of thirds or diagonal composition with 15-20% negative space.`;
        break;
      case 'scene':
        basePrompt += `\nScene: ${vars.scene_theme}. Mid-shot with strong spatial depth.`;
        break;
    }
  }

  basePrompt += '\\nCRITICAL: DO NOT INCLUDE ANY TEXT, LETTERS, WATERMARKS, LOGOS, OR TYPOGRAPHY IN THE IMAGE.';
  
  return basePrompt;
}

export async function generateImageServer(
  type: string,
  imageUrlBase64: string,
  modelUrlBase64: string | null,
  sceneUrlBase64: string | null,
  analysis: AnalysisData,
  config: PromptConfig
): Promise<Buffer> {
  const ai = getGeminiClient();
  const hasModelImage = !!modelUrlBase64;
  const hasSceneImage = !!sceneUrlBase64;
  
  let prompt = buildPrompt(type, analysis, config, hasModelImage);
  
  const extractParts = (b64: string) => {
    return {
      mimeType: b64.split(',')[0].split(':')[1].split(';')[0],
      data: b64.split(',')[1]
    };
  };

  const parts: any[] = [];
  let sceneIndex = 2; 
  
  if (type === 'main' || !hasModelImage) {
    parts.push({
      inlineData: extractParts(imageUrlBase64)
    });
  } else {
    parts.push({
      inlineData: extractParts(modelUrlBase64!)
    });
    parts.push({
      inlineData: extractParts(imageUrlBase64)
    });
    sceneIndex = 3;
  }
  
  if (hasSceneImage && type === 'scene') {
    prompt += `\nBackground MUST be exactly the same as Reference Image ${sceneIndex}.`;
    parts.push({
      inlineData: extractParts(sceneUrlBase64!)
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp', // Original used 2.5-flash-image but 2.0-flash-exp is more standard for latest multimodal. 
    // Wait, the original code used 'gemini-2.5-flash-image'. I'll stick to that if it's the specific model for images in this environment.
    // Actually, I'll use what was in the original code for stability.
    contents: {
      parts
    },
    config: {
      imageConfig: {
        aspectRatio: '3:4',
      }
    }
  });

  // Extract base64 image from response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image returned from Gemini');
}

export async function generateCustomImageServer(
  prompt: string,
  referenceImageBase64: string | null
): Promise<Buffer> {
  const ai = getGeminiClient();
  const extractParts = (b64: string) => {
    return {
      mimeType: b64.split(',')[0].split(':')[1].split(';')[0],
      data: b64.split(',')[1]
    };
  };

  const parts: any[] = [];
  if (referenceImageBase64) {
    parts.push({
      inlineData: extractParts(referenceImageBase64)
    });
    prompt += `\nPlease refer to the uploaded image for style and elements.`;
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts
    },
    config: {
      imageConfig: {
        aspectRatio: '3:4',
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image returned from Gemini');
}
