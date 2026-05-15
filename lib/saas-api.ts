
const SAAS_ORIGIN = (process.env.SAAS_ORIGIN || 'https://aibigtree.com').replace(/\/$/, '');

async function readJsonResponse(res: Response) {
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    // Some responses might not even allow text()
  }
  
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 300) };
  }

  if (!res.ok || data.success === false) {
    const msg = data.error || data.message || `请求失败: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}

async function safeFetch(url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err: any) {
    console.error(`Fetch error for ${url}:`, err);
    throw new Error(`fetch failed: ${err.message}`);
  }
}

export async function launchTool({ userId, toolId }: { userId: string, toolId: string }) {
  const res = await safeFetch(`${SAAS_ORIGIN}/api/tool/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId })
  });
  return readJsonResponse(res);
}

export async function verifyBeforeGenerate({ userId, toolId }: { userId: string, toolId: string }) {
  const res = await safeFetch(`${SAAS_ORIGIN}/api/tool/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId })
  });
  return readJsonResponse(res);
}

export async function consumeIntegral({ userId, toolId }: { userId: string, toolId: string }) {
  const res = await safeFetch(`${SAAS_ORIGIN}/api/tool/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId })
  });
  return readJsonResponse(res);
}

export async function getDirectUploadToken({
  userId,
  toolId,
  mimeType,
  fileName,
  fileSize
}: {
  userId: string,
  toolId: string,
  mimeType: string,
  fileName: string,
  fileSize: number
}) {
  const res = await safeFetch(`${SAAS_ORIGIN}/api/upload/direct-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      toolId,
      source: 'result',
      mimeType,
      fileName,
      fileSize
    })
  });
  return readJsonResponse(res);
}

export async function commitUpload({
  userId,
  toolId,
  objectKey,
  fileSize
}: {
  userId: string,
  toolId: string,
  objectKey: string,
  fileSize: number
}) {
  const res = await safeFetch(`${SAAS_ORIGIN}/api/upload/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      toolId,
      source: 'result',
      objectKey,
      fileSize
    })
  });
  return readJsonResponse(res);
}

export async function saveResultImageToSaas({
  userId,
  toolId,
  imageBuffer,
  mimeType = 'image/png',
  fileName = 'result.png'
}: {
  userId: string,
  toolId: string,
  imageBuffer: Buffer,
  mimeType?: string,
  fileName?: string
}) {
  // 1. Consume
  await consumeIntegral({ userId, toolId });

  // 2. Get Token
  const token = await getDirectUploadToken({
    userId,
    toolId,
    mimeType,
    fileName,
    fileSize: imageBuffer.byteLength
  });

  // 3. Upload to OSS
  const uploadRes = await safeFetch(token.uploadUrl, {
    method: token.method || 'PUT',
    headers: token.headers,
    body: imageBuffer as any
  });
  
  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => 'Unknown OSS error');
    throw new Error(`OSS 上传失败: ${uploadRes.status} ${errorText}`);
  }

  // 4. Commit
  const commit = await commitUpload({
    userId,
    toolId,
    objectKey: token.objectKey,
    fileSize: imageBuffer.byteLength
  });

  if (!commit.savedToRecords) {
    throw new Error(commit.error || '图片入库失败');
  }

  return commit.image || { recordId: commit.recordId, url: commit.url, fileName: commit.fileName };
}
