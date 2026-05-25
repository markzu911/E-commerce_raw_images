
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { AnalysisData, PromptConfig } from '@/types';

function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to your Secrets panel in Settings.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Wraps a promise with a timeout using Promise.race.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 120000, message = 'AI 处理超时(120s): 模型处理耗时过长...'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (error) {
    clearTimeout(timer!);
    throw error;
  }
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

  const responsePromise = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
  
  const result = await withTimeout(responsePromise);

  return JSON.parse(result.text!) as AnalysisData;
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
    CRITICAL: 100% IDENTICAL to the reference product image. Zero modifications to shape, color, texture, or details.
    Product: ${garmentDesc}
    Pure white background for product isolated display. Centered flat lay or hanging shot.
    NO TEXT, NO PEOPLE, NO MANNEQUINS.`;
  } else {
    if (hasModelImage) {
      basePrompt = `【面孔复刻 & 模特融合 - 最高优先级】
      1. MODEL: Identity and features MUST be exactly the same as Reference Image 1. Pose can be different and dynamic.
      2. GARMENT: MUST be 100% IDENTICAL to the product in Reference Image 2. No changes in style, material, or color.
      Vibe: ${vars.model_style}.
      Garment: ${garmentDesc}.`;
    } else {
      basePrompt = `【模特上身展示】
      1. GARMENT: MUST be 100% IDENTICAL to the reference product image. Zero modifications.
      2. MODEL: Professional model, ${vars.model_style} vibe. Natural posing.
      Garment: ${garmentDesc}.`;
    }

    switch (type) {
      case 'detail':
        basePrompt += `\nScene: Fabric and craftsmanship close-up detail shot. Dark grey monochrome background. Focus on original textures from reference.`;
        break;
      case 'sellingPoint':
        basePrompt += `\nScene: Morandi color portrait background (oatmeal/beige/milk tea). Clean and high-end studio lighting.`;
        break;
      case 'scene':
        basePrompt += `\nScene: ${vars.scene_theme}. Professional fashion photography background. Keep scene details consistent if a scene reference is provided.`;
        break;
    }
  }

  basePrompt += '\\nCRITICAL: ABSOLUTELY NO TEXT, LOGOS (other than product ones), OR TYPOGRAPHY IN THE OUTPUT IMAGE.';
  
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
  
  // Enhancement for 2K/4K resolutions
  if (config.resolution === '2k') {
    prompt += '\n[QUALITY BOOST: 2K High Definition, 8k resolution, photorealistic, sharp focus, professional fashion photography, extremely detailed textures, clean edges, studio quality lighting]';
  } else if (config.resolution === '4k') {
    prompt += '\n[QUALITY BOOST: 4K Ultra HD, masterpiece, extreme cinematic lighting, hyper-realistic, super-resolution, intricate details, raw photo quality, sharp details on fabric and skin, high dynamic range]';
  }
  
  const extractParts = (b64: string) => {
    return {
      mimeType: b64.split(',')[0].split(':')[1].split(';')[0],
      data: b64.split(',')[1]
    };
  };

  const parts: any[] = [];
  let sceneIndex = 2; 
  
  if (type === 'main' || !hasModelImage) {
    // Single reference: the product
    parts.push({
      inlineData: extractParts(imageUrlBase64)
    });
  } else {
    // Two references: 1. Model, 2. Product
    parts.push({
      inlineData: extractParts(modelUrlBase64!)
    });
    parts.push({
      inlineData: extractParts(imageUrlBase64)
    });
    sceneIndex = 3;
  }
  
  if (hasSceneImage && type === 'scene') {
    prompt += `\nBackground MUST be 100% consistent with the aesthetic and environment of Reference Image ${sceneIndex}.`;
    parts.push({
      inlineData: extractParts(sceneUrlBase64!)
    });
  }
  
  // Add a final forceful instruction
  prompt += `\nFinal strict instruction: Keep the product from the reference image 100% unchanged. Do not reinterpret. Just replicate it perfectly on the model/scene.`;

  parts.push({ text: prompt });
 
  const responsePromise = ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts
    },
    config: {
      imageConfig: {
        aspectRatio: config?.aspectRatio || '3:4',
      },
      safetySettings: [
        { category: HarmCategory.HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    }
  });

  const response = await withTimeout(responsePromise);

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
  referenceImageBase64: string | null,
  config?: any
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
    
    // Quality enhancement for custom mode
    let qualityPrompt = '';
    if (config?.resolution === '2k') {
      qualityPrompt = '\n[QUALITY: 2K UHD, sharp focus, extreme detail, 8k resolution, professional photography]';
    } else if (config?.resolution === '4k') {
      qualityPrompt = '\n[QUALITY: 4K Ultra HD, masterpiece, hyper-realistic, raw photo, intricate textures, sharp focus]';
    }

    prompt = `CRITICAL TASK: Maintain 100% identity and fidelity of the product shown in the reference image. 
    1. DO NOT change the product's shape, color, material, texture, or details. 
    2. Place this EXACT and UNCHANGED product into the following creative context: ${prompt}.
    3. The lighting and environment should naturally interact with the product without altering its inherent design.
    4. Pose variety is encouraged if there is a model, but the model's identity and the product's look must remain stable. ${qualityPrompt}`;
  }
  parts.push({ text: prompt });
  
  const responsePromise = ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts
    },
    config: {
      imageConfig: {
        aspectRatio: config?.aspectRatio || '3:4',
      },
      safetySettings: [
        { category: HarmCategory.HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    }
  });

  const response = await withTimeout(responsePromise);

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image returned from Gemini');
}
