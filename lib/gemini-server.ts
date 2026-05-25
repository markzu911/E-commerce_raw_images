
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold, GenerateVideosOperation } from '@google/genai';
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

export async function generateVideoServer(
  imageBase64: string,
  analysis?: AnalysisData,
  config?: PromptConfig
): Promise<string> {
  const ai = getGeminiClient();
  
  const base64Data = imageBase64.split(',')[1];
  const mimeType = imageBase64.split(',')[0].split(':')[1].split(';')[0];

  const productName = analysis?.productName || 'fashion product';
  const category = analysis?.category || 'apparel';
  const style = analysis?.style || 'modern';
  const colors = analysis?.colors?.join(', ') || '';
  const materials = analysis?.materials || '';
  const description = analysis?.description || '';
  
  // Highly explicit preservation rules for Google Veo to lock product/model/background but allow natural posture and expression changes
  const videoPrompt = `Professional cinematic high-end showcase of ${productName} (${category}) worn by the model. 
    Style: ${style}. ${colors ? `Colors: ${colors}.` : ''} ${materials ? `Materials: ${materials}.` : ''}
    Scene details: ${description || 'high-end elegant display'}.
    
    MOTION, POSTURE & EXPRESSION REQUIREMENTS:
    1. NATURAL MODEL MOVEMENT & POSTURES: The model should perform natural, elegant, and fluid movements. Incorporate organic posture adjustments, shifting body weight, turning of the body or head slightly, and graceful limb/hand gestures to make it look lively and professional.
    2. NATURAL FACIAL EXPRESSIONS: The model should display rich, natural, and friendly facial expressions, with realistic blinking, smiling warmly, head tilting, or gazing gracefully at or near the camera. No stiff or frozen faces.
    3. PRODUCT & CHARACTER IDENTITY CONSISTENCY: The model's identity (facial structure, hair) and the clothing's specific design, details, patterns, fabrics, materials, colors, and the background environment must remain consistent and recognizable from the starting frame.
    4. DYNAMIC & NATURAL WEAR PHYSICS: The clothing must move and drape realistically in response to the model's body postures, gestures, or a very gentle breeze, with no artificial texture sliding or pattern morphing.
    5. NO WARPING OR MORPHING: Rigidly prevent any AI warping, structural melting, sudden texture changes, or distortion of the model, clothing, or scene. Smooth cinematic camera motion (e.g. slow zoom, gentle track).
    6. HIGH-FIDELITY LUXURY LIGHTING: Premium luxury studio lighting. No text, logos, or captions.`;

  const operation = await ai.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt: videoPrompt,
    image: {
      imageBytes: base64Data,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  });

  if (!operation.name) {
    throw new Error('Failed to start video generation operation: No operation name returned');
  }

  return operation.name;
}

export async function getVideoStatusServer(operationName: string): Promise<{ done: boolean; error?: string }> {
  const ai = getGeminiClient();
  const op = new GenerateVideosOperation();
  op.name = operationName;
  
  const updated = await ai.operations.getVideosOperation({ operation: op });
  
  if (updated.error) {
    return { done: true, error: (updated.error as any).message || '视频生成出错' };
  }
  
  return { done: !!updated.done };
}

export async function downloadVideoServer(operationName: string, rangeHeader?: string | null): Promise<Response> {
  const ai = getGeminiClient();
  const op = new GenerateVideosOperation();
  op.name = operationName;
  
  const updated = await ai.operations.getVideosOperation({ operation: op });
  const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
  
  if (!uri) {
    throw new Error('Video URI not found in completed operation');
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const headers: Record<string, string> = {
    'x-goog-api-key': apiKey,
  };
  
  if (rangeHeader) {
    headers['range'] = rangeHeader;
  }
  
  const videoRes = await fetch(uri, { headers });
  
  if (!videoRes.ok) {
    const text = await videoRes.text().catch(() => 'Unknown error');
    throw new Error(`Google API video fetch failed with status ${videoRes.status}: ${text}`);
  }

  return videoRes;
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
  
  let qualityBoost = '';
  if (config.resolution === '2k') {
    qualityBoost = '[QUALITY: 2K UHD, 8k resolution, high definition, sharp focus, professional studio photography, extremely detailed textures]. ';
  } else if (config.resolution === '4k') {
    qualityBoost = '[QUALITY: 4K Ultra HD, masterpiece, raw photo, 16k resolution, hyper-realistic, super-resolution, cinematic lighting, extreme detail, high dynamic range]. ';
  }
  
  let prompt = qualityBoost + buildPrompt(type, analysis, config, hasModelImage);
  
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
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
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
      qualityPrompt = '[QUALITY: 2K UHD, 8k resolution, sharp focus, extreme detail, professional photography]. ';
    } else if (config?.resolution === '4k') {
      qualityPrompt = '[QUALITY: 4K Ultra HD, masterpiece, 16k resolution, hyper-realistic, raw photo, intricate textures, sharp focus, cinematic lighting]. ';
    }

    prompt = `CRITICAL TASK: Maintain 100% identity and fidelity of the product shown in the reference image. 
    1. DO NOT change the product's shape, color, material, texture, or details. 
    2. Place this EXACT and UNCHANGED product into the following creative context: ${qualityPrompt}${prompt}.
    3. The lighting and environment should naturally interact with the product without altering its inherent design.
    4. Pose variety is encouraged if there is a model, but the model's identity and the product's look must remain stable.`;
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
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
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
