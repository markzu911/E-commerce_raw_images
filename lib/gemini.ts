import { AnalysisData, PromptConfig } from '@/types';

/**
 * Analyzes the given image base64 using our server-side API.
 */
export async function analyzeImage(imageBase64: string, type: string): Promise<AnalysisData> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, type })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '分析失败');
  }
  return data.data;
}

/**
 * Generates an image using our server-side API (Smart Mode).
 */
export async function generateImage(
  type: string,
  imageUrlBase64: string,
  modelUrlBase64: string | null,
  sceneUrlBase64: string | null,
  analysis: AnalysisData,
  config: PromptConfig,
  userId: string,
  toolId: string
): Promise<{ imageUrl: string; recordId: string }> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'smart',
      userId,
      toolId,
      type,
      imageUrlBase64,
      modelUrlBase64,
      sceneUrlBase64,
      analysis,
      config
    })
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '生成失败');
  }
  return {
    imageUrl: data.imageUrl,
    recordId: data.image.recordId
  };
}

/**
 * Generates an image using our server-side API (Custom Mode).
 */
export async function generateCustomImage(
  prompt: string,
  referenceImageBase64: string | null,
  userId: string,
  toolId: string
): Promise<{ imageUrl: string; recordId: string }> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'custom',
      userId,
      toolId,
      prompt,
      referenceImageBase64
    })
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '生成失败');
  }
  return {
    imageUrl: data.imageUrl,
    recordId: data.image.recordId
  };
}
