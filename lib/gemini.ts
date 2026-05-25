import { AnalysisData, PromptConfig } from '@/types';

/**
 * Resizes an image base64 on client side ensuring it's not too large for the API limits.
 */
async function resizeImage(base64: string, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
  });
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 120000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('请求超时 (120s): 服务器响应时间过长，请稍后重试。');
    }
    throw error;
  }
}

/**
 * Analyzes the given image base64 using our server-side API.
 */
export async function analyzeImage(imageBase64: string, type: string): Promise<AnalysisData> {
  // Resize if likely to exceed limit (arbitrary check on string length)
  let processedBase64 = imageBase64;
  if (imageBase64.length > 500000) {
    try {
      processedBase64 = await resizeImage(imageBase64);
    } catch (e) {
      console.warn('Failed to resize image on client:', e);
    }
  }

  const res = await fetchWithTimeout('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: processedBase64, type })
  });
  
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = '分析失败';
    try {
      const parsed = JSON.parse(text);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = `请求错误 ${res.status}: ${text.slice(0, 100)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
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
  const [main, model, scene] = await Promise.all([
    resizeImage(imageUrlBase64),
    modelUrlBase64 ? resizeImage(modelUrlBase64) : null,
    sceneUrlBase64 ? resizeImage(sceneUrlBase64) : null
  ]);

  const res = await fetchWithTimeout('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'smart',
      userId,
      toolId,
      type,
      imageUrlBase64: main,
      modelUrlBase64: model,
      sceneUrlBase64: scene,
      analysis,
      config
    })
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMsg = '生成失败';
    try {
      const parsed = JSON.parse(text);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = `请求错误 ${res.status}: ${text.slice(0, 100)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
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
  toolId: string,
  resolution: '1k' | '2k' | '4k' = '2k'
): Promise<{ imageUrl: string; recordId: string }> {
  const processedRef = referenceImageBase64 ? await resizeImage(referenceImageBase64) : null;

  const res = await fetchWithTimeout('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'custom',
      userId,
      toolId,
      prompt,
      referenceImageBase64: processedRef,
      config: { resolution }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMsg = '生成失败';
    try {
      const parsed = JSON.parse(text);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = `请求错误 ${res.status}: ${text.slice(0, 100)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return {
    imageUrl: data.imageUrl,
    recordId: data.image.recordId
  };
}

/**
 * Generates a display video using our server-side API with polling.
 */
export async function generateVideo(
  imageBase64: string,
  userId: string,
  toolId: string
): Promise<{ videoUrl: string }> {
  const processedBase64 = imageBase64.length > 500000 ? await resizeImage(imageBase64) : imageBase64;

  // 1. Start job
  const startRes = await fetchWithTimeout('/api/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrlBase64: processedBase64,
      userId,
      toolId
    })
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`启动错误 ${startRes.status}: ${text.slice(0, 100)}`);
  }

  const { operationName } = await startRes.json();

  // 2. Poll status
  let attempts = 0;
  const maxAttempts = 120; // 120 * 5s = 600s = 10 minutes
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    const statusRes = await fetch('/api/video/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName })
    });

    if (!statusRes.ok) continue;

    const { done, error } = await statusRes.json();
    
    if (error) {
      throw new Error(`视频生成错误: ${error}`);
    }

    if (done) {
      // 3. Return the download URL
      const videoUrl = `/api/video/download?operationName=${encodeURIComponent(operationName)}`;
      return { videoUrl };
    }
  }

  throw new Error('视频生成超时，模型处理耗时过长，请稍后刷新重试。');
}
