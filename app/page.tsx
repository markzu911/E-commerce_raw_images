'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditableTextField, EditableTagList } from '@/components/EditableField';
import { AnalysisData, PromptConfig, Step, TextOverlayConfig } from '@/types';
import { analyzeImage, generateImage, generateCustomImage } from '@/lib/gemini';
import { Loader2, Upload, Download, CheckCircle, Image as ImageIcon, Sparkles, Maximize2, Edit2, Zap } from 'lucide-react';
import { drawTextOverlay } from '@/lib/canvas-utils';

const PRESET_SCENES = [
  '都市街头 (Urban Street)',
  '法式咖啡馆 (French Cafe)',
  '海边度假 (Beach Resort)',
  '极简影棚 (Minimal Studio)',
  '自然治愈 (Nature Healing)',
];

/**
 * Frontend image compression
 */
async function compressImage(base64: string, maxWidth = 1200, maxHeight = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
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
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = base64;
  });
}

export default function Page() {
  const [step, setStep] = useState<Step>('upload');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [modelBase64, setModelBase64] = useState<string>('');
  const [sceneBase64, setSceneBase64] = useState<string>('');
  
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [config, setConfig] = useState<PromptConfig>({
    garmentCategory: '', garmentColor: '', garmentMaterial: '', garmentStyle: '',
    modelStyle: '', sceneStyle: '', sellingPoint1: '', sellingPoint2: '', sellingPoint3: '',
    brandName: '', sceneTheme: ''
  });
  
  const [selectedType, setSelectedType] = useState<string>('main');
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [activeMode, setActiveMode] = useState<'smart' | 'custom'>('smart');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customResult, setCustomResult] = useState<string>('');

  const [userId, setUserId] = useState<string>('');
  const [toolId, setToolId] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [toolData, setToolData] = useState<any>(null);
  const [launchError, setLaunchError] = useState<string>('');

  const ALL_TYPES = [
    { id: 'main', label: '商品主图' },
    { id: 'detail', label: '商品详情图' },
    { id: 'sellingPoint', label: '卖点图' },
    { id: 'scene', label: '场景图' }
  ];

  const launchCalled = useRef(false);

  const callLaunch = useCallback(async (uid: string, tid: string, force = false) => {
    if (launchCalled.current && !force) return;
    launchCalled.current = true;
    setLaunchError('');
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, toolId: tid })
      });
      const data = await res.json();
      if (data.success) {
        setUserData(data.data.user);
        setToolData(data.data.tool);
      } else {
        setLaunchError(data.error || '身份校验失败');
      }
    } catch (err: any) {
      console.error('Launch failed', err);
      setLaunchError(err.message || '加载用户信息失败');
      if (!force) launchCalled.current = false;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uId = params.get('userId');
    const tId = params.get('toolId');
    
    requestAnimationFrame(() => {
      setMounted(true);
      if (uId) setUserId(uId);
      if (tId) setToolId(tId);
      if (uId && tId) {
        callLaunch(uId, tId);
      }
    });

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const msgUserId = event.data.userId;
        const msgToolId = event.data.toolId;
        if (msgUserId) setUserId(msgUserId);
        if (msgToolId) setToolId(msgToolId);
        
        if (msgUserId && msgToolId) {
          callLaunch(msgUserId, msgToolId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [callLaunch]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64 = event.target?.result as string;
      const compressed = await compressImage(b64);
      setImageBase64(compressed);
      setStep('select');
    };
    reader.readAsDataURL(file);
  };

  const startAnalysis = async () => {
    setStep('analyzing');
    try {
      const data = await analyzeImage(imageBase64, selectedType);
      setAnalysis(data);
      setConfig({
        garmentCategory: data.category || '',
        garmentColor: data.colors?.join(' ') || '',
        garmentMaterial: data.materials || '',
        garmentStyle: data.style || '',
        modelStyle: data.modelStyle || '',
        sceneStyle: data.sceneStyle || '',
        sellingPoint1: data.sellingPoints?.[0] || '',
        sellingPoint2: data.sellingPoints?.[1] || '',
        sellingPoint3: data.sellingPoints?.[2] || '',
        brandName: data.brandName || '',
        sceneTheme: data.posterTheme || '展示场景',
      });
      setStep('result');
    } catch (err: any) {
      console.error(err);
      alert(`分析失败: ${err.message}`);
      setStep('upload');
    }
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target?.result as string);
      setModelBase64(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleSceneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target?.result as string);
      setSceneBase64(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!analysis) return;
    if (!userId || !toolId) {
      alert('缺少身份信息 (userId/toolId)，无法生成');
      return;
    }
    setStep('generating');
    setIsGenerating(true);

    try {
      const { imageUrl } = await generateImage(
        selectedType, 
        imageBase64, 
        modelBase64 || null, 
        sceneBase64 || null, 
        analysis, 
        config,
        userId,
        toolId
      );
      setGeneratedImages(prev => ({ ...prev, [selectedType]: imageUrl }));
      // Refresh user integral
      callLaunch(userId, toolId, true);
    } catch (e: any) {
      console.error(`Failed to generate ${selectedType}`, e);
      alert(`生成失败: ${e.message}`);
    }
    
    setIsGenerating(false);
    setStep('done');
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target?.result as string);
      setImageBase64(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt) return;
    if (!userId || !toolId) {
      alert('缺少身份信息 (userId/toolId)，无法生成');
      return;
    }
    setIsGenerating(true);
    setCustomResult('');
    try {
      const { imageUrl } = await generateCustomImage(customPrompt, imageBase64 || null, userId, toolId);
      setCustomResult(imageUrl);
      // Refresh user integral
      callLaunch(userId, toolId, true);
    } catch (e: any) {
      console.error('Failed to generate image', e);
      alert(`生成失败: ${e.message}`);
    }
    setIsGenerating(false);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <header className="bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-6 w-1/3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold hidden sm:block">AI 服装电商生图工具</h1>
          </div>
          <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'smart'|'custom')} className="w-[200px]">
             <TabsList>
               <TabsTrigger value="smart">智能生图</TabsTrigger>
               <TabsTrigger value="custom">自由生图</TabsTrigger>
             </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center justify-center gap-4 text-sm font-medium w-1/3 hidden md:flex">
          {activeMode === 'smart' && (
            <>
              <span className={step === 'upload' ? 'text-primary' : 'text-muted-foreground'}>1. 上传</span>
              <span>→</span>
              <span className={step === 'select' ? 'text-primary' : 'text-muted-foreground'}>2. 选择</span>
              <span>→</span>
              <span className={(step === 'analyzing' || step === 'result') ? 'text-primary' : 'text-muted-foreground'}>3. 配置</span>
              <span>→</span>
              <span className={(step === 'generating' || step === 'done') ? 'text-primary' : 'text-muted-foreground'}>4. 生成</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3 min-w-0">
          {userData && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold whitespace-nowrap">
              <span className="text-muted-foreground">{userData.name}</span>
              <div className="w-px h-3 bg-slate-300 mx-1" />
              <span className="text-primary">{userData.integral} 积分</span>
            </div>
          )}
          {activeMode === 'smart' && step !== 'upload' && (
            <>
              {step === 'select' && (
                <Button variant="outline" size="sm" onClick={() => setStep('upload')}>返回上传</Button>
              )}
              {step === 'result' && (
                <Button variant="outline" size="sm" onClick={() => setStep('select')}>返回选择</Button>
              )}
              {step === 'done' && (
                <Button variant="outline" size="sm" onClick={() => setStep('result')}>返回配置</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => {
                setStep('upload');
                setImageBase64('');
                setAnalysis(null);
                setModelBase64('');
              }}>重新开始</Button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        {launchError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold">加载错误:</span>
              <span>{launchError}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="text-red-600 hover:bg-red-100">刷新重试</Button>
          </div>
        )}

        {activeMode === 'smart' && (
          <>
            {step === 'upload' && (
              <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-100/50 hover:bg-slate-100 cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-12 h-12 text-slate-400 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">上传服装图片</h2>
                <p className="text-muted-foreground mb-6">拖拽图片至此或点击浏览</p>
                <Button>选择图片</Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </div>
            )}

            {step === 'select' && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                <h2 className="text-2xl font-semibold mb-8">选择需要生成的图片类型</h2>
                <div className="flex flex-wrap items-center justify-center gap-4 max-w-2xl mb-12">
                  {ALL_TYPES.map(type => (
                    <Button 
                      key={type.id} 
                      variant={selectedType === type.id ? 'default' : 'outline'}
                      onClick={() => setSelectedType(type.id)}
                      className="px-6 py-6 text-lg"
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
                <Button size="lg" onClick={startAnalysis} className="px-12">
                  开始分析配置
                </Button>
              </div>
            )}

            {step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center py-32">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-2xl font-semibold mb-2">正在分析商品...</h2>
                <p className="text-muted-foreground">AI 正在提取详情、风格和卖点</p>
              </div>
            )}

            {step === 'result' && analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1 space-y-6">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">参考图片</h3>
                  <img src={imageBase64} className="w-full h-auto rounded-lg shadow-sm border mb-4" alt="Original" />
                  
                  {selectedType !== 'main' && selectedType !== 'detail' && (
                    <>
                      <h3 className="font-semibold mb-2 mt-6 text-sm uppercase tracking-wider">添加模特（可选）</h3>
                      {modelBase64 ? (
                        <div className="relative">
                          <img src={modelBase64} className="w-full h-auto rounded-lg shadow-sm border" alt="Model" />
                          <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => setModelBase64('')}>移除</Button>
                        </div>
                      ) : (
                        <div className="border border-dashed p-6 flex flex-col items-center justify-center rounded-lg bg-slate-50 cursor-pointer" onClick={() => modelInputRef.current?.click()}>
                          <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                          <span className="text-xs text-muted-foreground">上传自定义模特</span>
                          <input type="file" ref={modelInputRef} className="hidden" accept="image/*" onChange={handleModelUpload} />
                        </div>
                      )}
                    </>
                  )}

                  {selectedType === 'scene' && (
                    <>
                      <h3 className="font-semibold mb-2 mt-6 text-sm uppercase tracking-wider">自定义背景图（可选）</h3>
                      {sceneBase64 ? (
                        <div className="relative">
                          <img src={sceneBase64} className="w-full h-auto rounded-lg shadow-sm border" alt="Scene" />
                          <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => setSceneBase64('')}>移除</Button>
                        </div>
                      ) : (
                        <div className="border border-dashed p-6 flex flex-col items-center justify-center rounded-lg bg-slate-50 cursor-pointer" onClick={() => sceneInputRef.current?.click()}>
                          <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                          <span className="text-xs text-muted-foreground">上传自定义背景图</span>
                          <input type="file" ref={sceneInputRef} className="hidden" accept="image/*" onChange={handleSceneUpload} />
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <Tabs defaultValue="analysis">
                    <TabsList className="mb-6 w-full">
                      <TabsTrigger value="analysis" className="flex-1">AI 提取数据</TabsTrigger>
                      <TabsTrigger value="config" className="flex-1">提示词配置</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="analysis" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <EditableTextField label="商品名称" value={analysis.productName} onChange={(v) => setAnalysis({...analysis, productName: v})} />
                        <EditableTextField label="类别" value={analysis.category} onChange={(v) => setAnalysis({...analysis, category: v})} />
                        <EditableTextField label="风格" value={analysis.style} onChange={(v) => setAnalysis({...analysis, style: v})} />
                        <EditableTextField label="材质" value={analysis.materials} onChange={(v) => setAnalysis({...analysis, materials: v})} />
                      </div>
                      <EditableTextField label="目标受众" value={analysis.targetAudience} onChange={(v) => setAnalysis({...analysis, targetAudience: v})} />
                      <EditableTextField label="描述" value={analysis.description} onChange={(v) => setAnalysis({...analysis, description: v})} />
                      
                      <EditableTagList label="颜色" tags={analysis.colors} onChange={(v) => setAnalysis({...analysis, colors: v})} />
                      <EditableTagList label="卖点" tags={analysis.sellingPoints} onChange={(v) => setAnalysis({...analysis, sellingPoints: v})} />
                      <EditableTagList label="关键词" tags={analysis.keywords} onChange={(v) => setAnalysis({...analysis, keywords: v})} />
                    </TabsContent>
                    
                    <TabsContent value="config" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <EditableTextField label="服装类别" value={config.garmentCategory} onChange={(v) => setConfig({...config, garmentCategory: v})} />
                        <EditableTextField label="服装颜色" value={config.garmentColor} onChange={(v) => setConfig({...config, garmentColor: v})} />
                        <EditableTextField label="服装材质" value={config.garmentMaterial} onChange={(v) => setConfig({...config, garmentMaterial: v})} />
                        <EditableTextField label="服装风格" value={config.garmentStyle} onChange={(v) => setConfig({...config, garmentStyle: v})} />
                        {selectedType !== 'main' && selectedType !== 'detail' && <EditableTextField label="模特气质" value={config.modelStyle} onChange={(v) => setConfig({...config, modelStyle: v})} />}
                        {(selectedType === 'scene' || selectedType === 'sellingPoint') && <EditableTextField label="场景风格" value={config.sceneStyle} onChange={(v) => setConfig({...config, sceneStyle: v})} />}
                      </div>
                      <div className="space-y-3 pt-4 border-t mt-4">
                        <h4 className="text-sm font-medium">附加主题与卖点</h4>
                        {selectedType === 'scene' && (
                          <div className="space-y-3">
                            <EditableTextField label="场景主题" value={config.sceneTheme} onChange={(v) => setConfig({...config, sceneTheme: v})} />
                            <div className="flex flex-wrap gap-2 mt-2">
                              {PRESET_SCENES.map((scene) => (
                                <Button 
                                  key={scene} 
                                  variant="outline" 
                                  size="sm" 
                                  className={config.sceneTheme === scene ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                                  onClick={() => setConfig({...config, sceneTheme: scene})}
                                >
                                  {scene}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">您可以选择上方的预设场景，或者手动输入您想要的场景主题。如果您在左侧上传了自定义背景图，将优先使用您上传的图片还原。</p>
                          </div>
                        )}
                        {selectedType === 'sellingPoint' && <EditableTextField label="主要卖点" value={analysis?.sellingPoints?.[0] || '品质如一'} onChange={(v) => {
                          if (!analysis) return;
                          const sps = [...(analysis.sellingPoints || [''])];
                          sps[0] = v;
                          setAnalysis({...analysis, sellingPoints: sps});
                        }} />}
                        {selectedType !== 'scene' && selectedType !== 'sellingPoint' && <p className="text-xs text-muted-foreground">当前选中类型无需配置额外主题</p>}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <div className="text-sm text-muted-foreground flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> 准备就绪
                    </div>
                    <Button onClick={handleGenerate} size="lg" className="px-8">
                      生成图片
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {(step === 'generating' || step === 'done') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold">
                {isGenerating ? '正在生成素材...' : '生成完成'}
              </h2>
              <div className="flex items-center gap-4">
                {isGenerating && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                {step === 'done' && (
                  <>
                    <Button variant="outline" onClick={() => setStep('select')}>生成其他类型图片</Button>
                    <Button variant="secondary" onClick={() => setStep('result')}>修改当前配置</Button>
                    <Button onClick={handleGenerate}>重新生成</Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-center w-full">
              <ResultCard 
                type={selectedType} 
                imgSrc={generatedImages[selectedType]} 
                analysis={analysis!} 
              />
            </div>
          </div>
        )}
        </>
        )}

        {activeMode === 'custom' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex flex-col items-center mb-8">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h2 className="text-2xl font-bold">自由生图</h2>
              <p className="text-muted-foreground mt-2">完全自定义 Prompt，释放无限可能</p>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-3 block">1. 上传参考图 (可选)</Label>
                  {imageBase64 ? (
                     <div className="relative inline-block">
                        <img src={imageBase64} className="h-48 w-auto rounded-lg shadow-sm border" alt="Custom Reference" />
                        <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => setImageBase64('')}>移除</Button>
                     </div>
                  ) : (
                    <div className="border border-dashed p-8 flex flex-col items-center justify-center rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => customInputRef.current?.click()}>
                      <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-muted-foreground">点击上传图片作为参考风格</span>
                      <input type="file" ref={customInputRef} className="hidden" accept="image/*" onChange={handleCustomUpload} />
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">2. 输入你的提示词 (Prompt)</Label>
                  <textarea 
                    className="w-full min-h-[150px] p-4 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" 
                    placeholder="描述你想要的图片，例如：\n极简纯白背景，一件oversize风格的黑色卫衣挂在木质衣架上..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">提示：参考图片和详细描述结合能带来最佳效果</p>
                  <Button size="lg" onClick={handleCustomGenerate} disabled={!customPrompt || isGenerating} className="px-8">
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    {isGenerating ? '生成中...' : '开始生成'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {customResult && (
              <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-8">
                <h3 className="text-xl font-semibold mb-6">生成结果</h3>
                <div className="inline-block relative rounded-xl overflow-hidden shadow-xl border">
                  <img src={customResult} className="max-w-full max-h-[70vh] object-contain" alt="Custom Generated" />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex justify-end gap-3">
                    <Button variant="secondary" size="sm" onClick={() => {
                      const link = document.createElement('a');
                      link.download = `custom-generation.png`;
                      link.href = customResult;
                      link.click();
                    }}>
                      <Download className="w-4 h-4 mr-2" />
                      下载
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

function ResultCard({ type, imgSrc, analysis }: { type: string; imgSrc?: string; analysis: AnalysisData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [tConf, setTConf] = useState<TextOverlayConfig>({
    mainTitle: analysis?.productName || '优质商品',
    subTitle: analysis?.style || '风格',
    price: '¥299',
    promoBadge: 'NEW',
    detailInfo: [analysis.productName, analysis.materials, analysis.style, analysis.season].filter(Boolean) as string[],
    sellingPointTexts: analysis.sellingPoints || ['品质卓越'],
    sceneTitle: analysis.brandName || '品牌',
    sceneSubtitle: analysis.posterTheme || '探索世界'
  });

  const labels: Record<string, string> = {
    main: '商品主图',
    detail: '商品详情',
    sellingPoint: '核心卖点',
    scene: '场景图'
  };

  const [previewUrl, setPreviewUrl] = useState<string>('');

  const drawCanvas = useCallback(() => {
    if (!imgSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous"; // Ensure we can read back from canvas if needed
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      drawTextOverlay(canvas, type, tConf);
      setPreviewUrl(canvas.toDataURL());
    };
    img.src = imgSrc;
  }, [imgSrc, type, tConf]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const downloadImage = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `${type}-final.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  return (
    <Card className="overflow-hidden shadow-lg border-2 border-slate-100 max-w-sm mx-auto w-full">
      <div className="bg-slate-100 aspect-[3/4] relative flex items-center justify-center group">
        {imgSrc ? (
          <>
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 px-2">
              <Button size="icon" variant="secondary" onClick={() => setIsPreviewOpen(true)} title="预览大图">
                <Maximize2 className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setIsEditOpen(true)} title="编辑文字">
                <Edit2 className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="secondary" onClick={downloadImage} title="下载图片">
                <Download className="w-5 h-5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
            <span className="text-sm text-slate-500">正在生成...</span>
          </div>
        )}
      </div>
      <div className="p-4 bg-white border-t flex justify-between items-center text-center">
        <span className="font-medium text-lg w-full">{labels[type]}</span>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-1 bg-black/5 border-none shadow-none">
          {imgSrc && (
            <img 
              src={previewUrl || imgSrc} 
              alt="Preview" 
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg" 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑文案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>主标题</Label>
              <Input value={tConf.mainTitle} onChange={(e) => setTConf({...tConf, mainTitle: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>副标题 / 风格</Label>
              <Input value={tConf.subTitle} onChange={(e) => setTConf({...tConf, subTitle: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>价格</Label>
              <Input value={tConf.price} onChange={(e) => setTConf({...tConf, price: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>徽标 (Promo Badge)</Label>
              <Input value={tConf.promoBadge} onChange={(e) => setTConf({...tConf, promoBadge: e.target.value})} />
            </div>
            {type === 'detail' && (
              <div className="space-y-2">
                <Label>详情面板文本 (逗号分隔)</Label>
                <Input 
                  value={tConf.detailInfo.join(', ')} 
                  onChange={(e) => setTConf({...tConf, detailInfo: e.target.value.split(',').map(s=>s.trim())})} 
                />
              </div>
            )}
            {type === 'sellingPoint' && (
              <div className="space-y-2">
                <Label>卖点文本 (逗号分隔)</Label>
                <Input 
                  value={tConf.sellingPointTexts.join(', ')} 
                  onChange={(e) => setTConf({...tConf, sellingPointTexts: e.target.value.split(',').map(s=>s.trim())})} 
                />
              </div>
            )}
            {type === 'scene' && (
              <>
                <div className="space-y-2">
                  <Label>场景主标题 (品牌)</Label>
                  <Input value={tConf.sceneTitle} onChange={(e) => setTConf({...tConf, sceneTitle: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>场景副标题</Label>
                  <Input value={tConf.sceneSubtitle} onChange={(e) => setTConf({...tConf, sceneSubtitle: e.target.value})} />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setIsEditOpen(false)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
