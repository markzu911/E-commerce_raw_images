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
import { analyzeImage, generateImage, generateCustomImage, generateVideo } from '@/lib/gemini';
import { Loader2, Upload, Download, CheckCircle, Image as ImageIcon, Sparkles, Maximize2, Edit2, Zap, Video, Play, X } from 'lucide-react';
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
  const [imageBase64, setImageBase64] = useState<string>(''); // Product image for smart mode
  const [modelBase64, setModelBase64] = useState<string>('');
  const [sceneBase64, setSceneBase64] = useState<string>('');
  const [customReferenceBase64, setCustomReferenceBase64] = useState<string>(''); // Reference for custom mode
  
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'loading' | null, content: string }>({ type: null, content: '' });
  
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [config, setConfig] = useState<PromptConfig>({
    garmentCategory: '', garmentColor: '', garmentMaterial: '', garmentStyle: '',
    modelStyle: '', sceneStyle: '', sellingPoint1: '', sellingPoint2: '', sellingPoint3: '',
    brandName: '', sceneTheme: '', resolution: '2k',
    aspectRatio: '1:1'
  });
  
  const [selectedType, setSelectedType] = useState<string>('main');
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [activeMode, setActiveMode] = useState<'smart' | 'custom'>('smart');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customResolution, setCustomResolution] = useState<'1k' | '2k' | '4k'>('2k');
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
      const res = await fetch('/api/tool/launch', {
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
    setStatusMsg({ type: null, content: '' });
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
        resolution: '2k'
      });
      setStep('result');
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', content: `分析失败: ${err.message}` });
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
      setStatusMsg({ type: 'error', content: '缺少身份信息 (userId/toolId)，无法生成' });
      return;
    }
    setStep('generating');
    setIsGenerating(true);
    setStatusMsg({ type: 'loading', content: '正在生成并保存中...' });

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
      setStatusMsg({ type: 'success', content: '生成成功！' });
      // Refresh user integral
      callLaunch(userId, toolId, true);
    } catch (e: any) {
      console.error(`Failed to generate ${selectedType}`, e);
      setStatusMsg({ type: 'error', content: `生成失败: ${e.message}` });
      setStep('result');
    }
    
    setIsGenerating(false);
    setStep('done');
    setTimeout(() => setStatusMsg({ type: null, content: '' }), 5000);
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target?.result as string);
      setCustomReferenceBase64(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt) return;
    if (!userId || !toolId) {
      setStatusMsg({ type: 'error', content: '缺少身份信息 (userId/toolId)，无法生成' });
      return;
    }
    setIsGenerating(true);
    setCustomResult('');
    setStatusMsg({ type: 'loading', content: '正在生成并保存中...' });
    try {
      const { imageUrl } = await generateCustomImage(customPrompt, customReferenceBase64 || null, userId, toolId, customResolution);
      setCustomResult(imageUrl);
      setStatusMsg({ type: 'success', content: '生成成功！' });
      // Refresh user integral
      callLaunch(userId, toolId, true);
    } catch (e: any) {
      console.error('Failed to generate image', e);
      setStatusMsg({ type: 'error', content: `生成失败: ${e.message}` });
    }
    setIsGenerating(false);
    setTimeout(() => setStatusMsg({ type: null, content: '' }), 5000);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-slate-950 pb-20">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-800 px-10 py-4 flex items-center justify-between sticky top-0 z-50 transition-all">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:rotate-6 transition-transform">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-[0.3em] uppercase leading-none mb-1">FashionAI</h1>
              <span className="text-[8px] font-bold text-primary/60 tracking-widest uppercase leading-none">Studio Pro v2</span>
            </div>
          </div>
          
          <nav className="flex items-center p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100/50">
             <button 
               onClick={() => setActiveMode('smart')}
               className={`px-6 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                 activeMode === 'smart' 
                 ? 'bg-white dark:bg-slate-700 shadow-md text-primary scale-[1.02]' 
                 : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               智能生图
             </button>
             <button 
               onClick={() => setActiveMode('custom')}
               className={`px-6 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                 activeMode === 'custom' 
                 ? 'bg-white dark:bg-slate-700 shadow-md text-primary scale-[1.02]' 
                 : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               自由生图
             </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-8">
          {activeMode === 'smart' && (
            <div className="hidden xl:flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${step === 'upload' ? 'text-primary' : 'text-slate-300'}`}>01 Upload</span>
                <div className={`w-8 h-[2px] rounded-full transition-colors ${step === 'upload' ? 'bg-primary/20' : 'bg-slate-100'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${step === 'select' ? 'text-primary' : 'text-slate-300'}`}>02 Style</span>
                <div className={`w-8 h-[2px] rounded-full transition-colors ${step === 'select' ? 'bg-primary/20' : 'bg-slate-100'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${(step === 'analyzing' || step === 'result') ? 'text-primary' : 'text-slate-300'}`}>03 Config</span>
                <div className={`w-8 h-[2px] rounded-full transition-colors ${(step === 'analyzing' || step === 'result') ? 'bg-primary/20' : 'bg-slate-100'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${(step === 'generating' || step === 'done') ? 'text-primary' : 'text-slate-300'}`}>04 Export</span>
              </div>
            </div>
          )}

          {userData && (
            <div className="flex items-center gap-4 pl-8 border-l border-slate-100 h-10">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-slate-800 dark:text-white tracking-widest leading-none mb-1.5">{userData.name}</span>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 dark:bg-primary rounded-full shadow-lg shadow-black/10">
                  <span className="text-[10px] font-black text-white leading-none tracking-widest">{userData.integral} <small className="opacity-50">PTS</small></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 md:p-8 mt-4">
        {statusMsg.type && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between shadow-sm border ${
            statusMsg.type === 'loading' ? 'bg-blue-50 border-blue-200 text-blue-600' :
            statusMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-600' :
            'bg-red-50 border-red-200 text-red-600'
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
              {statusMsg.type === 'success' && <CheckCircle className="w-5 h-5" />}
              <span className="font-medium">{statusMsg.content}</span>
            </div>
            {statusMsg.type !== 'loading' && (
              <Button variant="ghost" size="sm" onClick={() => setStatusMsg({ type: null, content: '' })} className="hover:bg-black/5">关闭</Button>
            )}
          </div>
        )}

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
              <div className="max-w-4xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="relative group p-1.5 rounded-[56px] bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-800">
                  <div className="absolute -inset-4 bg-primary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative flex flex-col items-center justify-center p-24 border border-slate-100 dark:border-slate-800 rounded-[48px] bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none hover:border-primary/20 transition-all cursor-pointer"
                       onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 bg-primary/5 rounded-[40px] flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <div className="w-16 h-16 bg-primary rounded-[32px] flex items-center justify-center shadow-xl shadow-primary/30">
                        <Upload className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <h2 className="text-4xl font-black tracking-tight mb-4 text-center">开始您的 AI 创作之旅</h2>
                    <p className="text-slate-400 font-medium mb-12 text-center max-w-sm leading-relaxed">
                      上传服装单品，Gemini 3.1 Pro 将精准捕捉面料、剪裁与风格，定制专属电商视觉大片。
                    </p>
                    <Button size="lg" className="rounded-full px-12 h-16 font-black text-lg shadow-2xl shadow-primary/20 group-hover:scale-105 transition-transform">
                      立即上传单品
                    </Button>
                    <div className="mt-12 flex items-center gap-4 opacity-30 grayscale">
                      <span className="text-[10px] font-black uppercase tracking-widest">Supports Jpeg / Png / Webp</span>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>
            )}

            {step === 'select' && (
              <div className="max-w-6xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/5 rounded-full border border-primary/10 mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Creative Direction</span>
                  </div>
                  <h2 className="text-5xl font-black tracking-tight mb-6">定义输出画幅与风格</h2>
                  <p className="text-slate-400 font-medium tracking-tight text-lg max-w-2xl mx-auto">
                    每一张生成的图片都经过视觉层级的深度优化，您可以针对不同的销售场景选择最佳画效。
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
                  {ALL_TYPES.map(type => (
                    <button 
                      key={type.id} 
                      onClick={() => setSelectedType(type.id)}
                      className={`relative p-10 rounded-[48px] border-2 text-left transition-all group duration-500 ${
                        selectedType === type.id 
                        ? 'border-primary bg-primary/[0.02] shadow-2xl shadow-primary/5 scale-[1.02]' 
                        : 'border-slate-50 bg-white hover:border-slate-100 hover:shadow-xl hover:shadow-slate-100/50'
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center mb-8 transition-all duration-500 shadow-lg ${
                        selectedType === type.id ? 'bg-primary text-primary-foreground shadow-primary/20 rotate-6' : 'bg-slate-50 text-slate-400 shadow-none'
                      }`}>
                         {type.id === 'main' && <ImageIcon className="w-8 h-8" />}
                         {type.id === 'detail' && <Maximize2 className="w-8 h-8" />}
                         {type.id === 'sellingPoint' && <Sparkles className="w-8 h-8" />}
                         {type.id === 'scene' && <ImageIcon className="w-8 h-8" />}
                      </div>
                      <h3 className={`text-xl font-black mb-3 tracking-tight transition-colors ${selectedType === type.id ? 'text-primary' : 'text-slate-800'}`}>
                        {type.label}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-6">
                        {type.id === 'main' && '标准 1:1 特写。针对主图展示优化，背景通透、产品饱满。'}
                        {type.id === 'detail' && '高清微距感。细腻捕捉针脚、面料纹理与辅料细节。'}
                        {type.id === 'sellingPoint' && '广告级排版。结合核心卖点，打造极具沉浸感的营销视觉。'}
                        {type.id === 'scene' && '自然光影律动。模拟真实户内/户外环境，赋予商品温度。'}
                      </p>
                      
                      <div className="flex items-center gap-2">
                         <div className={`w-8 h-[2px] rounded-full transition-colors ${selectedType === type.id ? 'bg-primary' : 'bg-slate-100'}`} />
                         <span className={`text-[10px] font-black uppercase tracking-widest ${selectedType === type.id ? 'text-primary' : 'text-slate-300'}`}>
                           {selectedType === type.id ? 'Selected' : 'Select Style'}
                         </span>
                      </div>

                      {selectedType === type.id && (
                        <div className="absolute top-8 right-8">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button size="lg" onClick={startAnalysis} className="rounded-full px-20 h-16 font-black text-xl shadow-[0_20px_50px_rgba(var(--primary-rgb),0.2)] hover:scale-105 transition-all">
                    同步数据并分析 <Sparkles className="w-6 h-6 ml-3" />
                  </Button>
                </div>
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
              <div className="max-w-[1600px] mx-auto pb-24 px-6 sm:px-8 lg:px-12 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Header Section: Title & Main Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 pb-12 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-px bg-primary/30" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Intelligence Engine v3</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">定制精炼参数</h2>
                    <p className="text-base sm:text-lg text-slate-400 font-medium max-w-2xl leading-relaxed">
                      产品样式 100% 还原。基于垂直风格模型深度优化，您可以微调参数来掌控场景氛围与模特表现。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                     <Button variant="outline" className="rounded-2xl px-10 h-16 font-black border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all" onClick={() => setStep('select')}>
                       返回风格选择
                     </Button>
                     <Button onClick={handleGenerate} className="rounded-2xl px-14 h-16 font-black shadow-[0_25px_60px_rgba(var(--primary-rgb),0.25)] hover:bg-primary/90 hover:scale-105 transition-all text-xl group">
                       启动精炼生成 <Zap className="w-6 h-6 ml-3 fill-current group-hover:animate-pulse" />
                     </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                  {/* Left Sidebar: Assets */}
                  <aside className="lg:col-span-3 space-y-10 lg:sticky lg:top-[120px]">
                    <div className="relative">
                      <div className="absolute -inset-6 bg-primary/5 blur-[60px] opacity-50" />
                      <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[48px] overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
                        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Master Ref</span>
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary/20" />
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                        </div>
                        <div className="p-8">
                          <div className="relative group/ref overflow-hidden rounded-[32px]">
                             <img src={imageBase64} className="w-full aspect-[3/4] object-cover shadow-2xl border border-slate-50 group-hover:scale-110 transition-transform duration-700" alt="Original" />
                             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      <div className="grid gap-8">
                        {selectedType !== 'main' && selectedType !== 'detail' && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[40px] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/30 transition-all group">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 block">模特参考 (Portrait)</Label>
                            {modelBase64 ? (
                              <div className="relative rounded-[24px] overflow-hidden group/img shadow-2xl">
                                <img src={modelBase64} className="w-full aspect-[4/5] object-cover" alt="Model" />
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-[6px]">
                                  <Button size="sm" variant="secondary" className="rounded-full font-black text-[10px] uppercase tracking-widest" onClick={() => setModelBase64('')}>更换参考</Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="aspect-[4/5] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center rounded-[28px] bg-slate-50/50 dark:bg-slate-950 transition-all hover:border-primary/40 hover:bg-slate-50 cursor-pointer" 
                                onClick={() => modelInputRef.current?.click()}
                              >
                                <Sparkles className="w-8 h-8 text-primary/40 mb-4" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center px-6">上传人像参考</span>
                                <input type="file" ref={modelInputRef} className="hidden" accept="image/*" onChange={handleModelUpload} />
                              </div>
                            )}
                          </div>
                        )}

                        {selectedType === 'scene' && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[40px] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/30 transition-all group">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 block">背景参考 (Scene)</Label>
                            {sceneBase64 ? (
                              <div className="relative rounded-[24px] overflow-hidden group/img shadow-2xl">
                                <img src={sceneBase64} className="w-full aspect-[4/5] object-cover" alt="Scene" />
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-[6px]">
                                  <Button size="sm" variant="secondary" className="rounded-full font-black text-[10px] uppercase tracking-widest" onClick={() => setSceneBase64('')}>更换参考</Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="aspect-[4/5] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center rounded-[28px] bg-slate-50/50 dark:bg-slate-950 transition-all hover:border-primary/40 hover:bg-slate-50 cursor-pointer" 
                                onClick={() => sceneInputRef.current?.click()}
                              >
                                <ImageIcon className="w-8 h-8 text-primary/40 mb-4" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center px-6">上传背景底片</span>
                                <input type="file" ref={sceneInputRef} className="hidden" accept="image/*" onChange={handleSceneUpload} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </aside>

                  {/* Right Main Dashboard: 3 Columns of Parameters */}
                  <div className="lg:col-span-9 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[64px] shadow-2xl shadow-slate-200/30 dark:shadow-none p-12 lg:p-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] blur-[140px] -mr-80 -mt-80 rounded-full" />
                    <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/[0.03] blur-[140px] -ml-80 -mb-80 rounded-full" />
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12 xl:gap-20">
                      {/* Column 1: Data Analysis */}
                      <div className="space-y-12">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <span className="text-xs font-black">01</span>
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">数据分析</h3>
                        </div>
                        
                        <div className="space-y-8">
                          <EditableTextField label="商品对象" value={analysis.productName} onChange={(v) => setAnalysis({...analysis, productName: v})} />
                          <EditableTextField label="商品品类" value={analysis.category} onChange={(v) => setAnalysis({...analysis, category: v})} />
                          <EditableTextField label="面料纹理" value={analysis.materials} onChange={(v) => setAnalysis({...analysis, materials: v})} />
                          <EditableTextField label="核心描述" value={analysis.description} onChange={(v) => setAnalysis({...analysis, description: v})} />
                        </div>
                      </div>

                      {/* Column 2: Refine Parameters */}
                      <div className="space-y-12">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <span className="text-xs font-black">02</span>
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">精修参数</h3>
                        </div>

                        <div className="space-y-8">
                          <EditableTextField label="风格方向" value={config.garmentStyle} onChange={(v) => setConfig({...config, garmentStyle: v})} />
                          <EditableTextField label="材质细节" value={config.garmentMaterial} onChange={(v) => setConfig({...config, garmentMaterial: v})} />
                          <EditableTextField label="光影氛围" value={config.sceneStyle} onChange={(v) => setConfig({...config, sceneStyle: v})} />
                          <EditableTextField label="构图控制" value={config.garmentCategory} onChange={(v) => setConfig({...config, garmentCategory: v})} />
                        </div>
                        
                        <div className="p-8 bg-amber-500/5 rounded-[32px] border border-amber-500/10 shadow-inner">
                          <div className="flex items-center gap-3 mb-3">
                            <CheckCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">原图硬核还原</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                            系统将强制锁定原图中的产品结构与材质。参数调整仅影响环境光影、模特表现及场景融合度。
                          </p>
                        </div>
                      </div>

                      {/* Column 3: Output Specs */}
                      <div className="space-y-12 md:col-span-2 xl:col-span-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <span className="text-xs font-black">03</span>
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">输出规格</h3>
                        </div>

                        <div className="space-y-10">
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">分辨率 (Resolution)</Label>
                            <div className="grid grid-cols-3 gap-3">
                              {(['1k', '2k', '4k'] as const).map((res) => (
                                <button
                                  key={res}
                                  onClick={() => setConfig({ ...config, resolution: res })}
                                  className={`h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                                    config.resolution === res 
                                    ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                                    : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:border-primary/30'
                                  }`}
                                >
                                  {res === '1k' ? '标准 1K' : res === '2k' ? '高清 2K' : '超清 4K'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">画幅比例 (Aspect Ratio)</Label>
                            <div className="grid grid-cols-3 gap-3">
                              {(['1:1', '3:4', '9:16'] as const).map((ratio) => (
                                <button
                                  key={ratio}
                                  onClick={() => setConfig({ ...config, aspectRatio: ratio as any })}
                                  className={`h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                                    config.aspectRatio === ratio 
                                    ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                                    : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:border-primary/30'
                                  }`}
                                >
                                  {ratio}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="p-8 bg-primary/5 rounded-[32px] border border-primary/10 shadow-inner">
                            <div className="flex items-center gap-3 mb-3">
                              <Zap className="w-4 h-4 text-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Optimization</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                              AI 将基于您的规格自动调整光影采样率。4K 分辨率将开启深度细节增强。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Options Footer */}
                    <div className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-12">
                       <EditableTagList label="Color Schema (色彩方案)" tags={analysis.colors} onChange={(v) => setAnalysis({...analysis, colors: v})} />
                       <EditableTagList label="Value Props (卖点关键词)" tags={analysis.sellingPoints} onChange={(v) => setAnalysis({...analysis, sellingPoints: v})} />
                       <EditableTagList label="Semantic Keywords (语义词包)" tags={analysis.keywords} onChange={(v) => setAnalysis({...analysis, keywords: v})} />
                    </div>
                  </div>
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
                userId={userId}
                toolId={toolId}
                config={config}
              />
            </div>
          </div>
        )}
        </>
        )}

        {activeMode === 'custom' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-[28px] flex items-center justify-center mb-6">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-3">产品 + 创意：探索无限可能</h2>
              <p className="text-slate-400 font-medium tracking-tight px-4 max-w-2xl">
                上传您的单品原图，输入创意构思。AI 将保证产品样式 100% 还原，并根据您的描述灵活调整模特姿势与环境。
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 shadow-sm">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 block">产品原图 (100% 还原基础)</Label>
                  {customReferenceBase64 ? (
                     <div className="relative group rounded-2xl overflow-hidden aspect-square shadow-2xl">
                        <img src={customReferenceBase64} className="w-full h-full object-cover" alt="Custom Reference" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="sm" variant="secondary" onClick={() => setCustomReferenceBase64('')}>更换原图</Button>
                        </div>
                     </div>
                  ) : (
                    <div 
                      className="aspect-square border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center rounded-[32px] bg-slate-50/50 dark:bg-slate-950 transition-all hover:border-primary/40 hover:bg-slate-50 cursor-pointer group" 
                      onClick={() => customInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center px-6">点击上传产品原图<br/><small className="opacity-50">AI 将保证商品 100% 不变</small></span>
                      <input type="file" ref={customInputRef} className="hidden" accept="image/*" onChange={handleCustomUpload} />
                    </div>
                  )}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> 自由生图贴士
                  </h4>
                  <p className="text-[11px] text-emerald-600/70 font-medium leading-relaxed italic">
                    &quot;描述中包含：光效细节、材质质感、模特姿势、背景环境等。您可以自由构思，AI 将保证产品完美融入并 100% 还原。&quot;
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 block">输出清晰度</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['1k', '2k', '4k'] as const).map((res) => (
                      <button
                        key={res}
                        onClick={() => setCustomResolution(res)}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                          customResolution === res
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 shadow-sm">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 block">创意描述 (Prompt)</Label>
                  <textarea 
                    className="w-full min-h-[300px] p-6 text-lg font-medium border-none bg-slate-50/50 dark:bg-slate-950 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300" 
                    placeholder="例如：\n极简纯白背景，一件oversize风格的黑色卫衣挂在木质衣架上，柔和侧光，高清写实材质..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                  <div className="pt-8 flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={handleCustomGenerate} 
                      disabled={!customPrompt || isGenerating} 
                      className="rounded-full px-12 h-14 font-bold text-lg shadow-xl shadow-primary/20"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      {isGenerating ? '正在构思中...' : '开始生成'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {customResult && (
              <div className="pt-16 text-center animate-in fade-in slide-in-from-bottom-12">
                <div className="flex items-center justify-center gap-3 mb-10">
                  <div className="h-px w-12 bg-slate-100" />
                  <h3 className="text-2xl font-black tracking-tight uppercase">生成结果</h3>
                  <div className="h-px w-12 bg-slate-100" />
                </div>
                
                <div className="inline-block relative rounded-[40px] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                  <img src={customResult} className="max-w-full max-h-[75vh] object-contain" alt="Custom Generated" />
                  <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex justify-between items-end opacity-0 hover:opacity-100 transition-opacity duration-500">
                    <div className="text-left">
                       <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">自由生图模式</p>
                       <p className="text-white text-sm font-bold truncate max-w-xs">{customPrompt}</p>
                    </div>
                    <Button variant="secondary" size="lg" className="rounded-full font-bold px-8" onClick={() => {
                      const link = document.createElement('a');
                      link.download = `fashion-ai-custom.png`;
                      link.href = customResult;
                      link.click();
                    }}>
                      <Download className="w-4 h-4 mr-2" />
                      下载高清图
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

function ResultCard({ type, imgSrc, analysis, userId, toolId, config }: { type: string; imgSrc?: string; analysis: AnalysisData; userId: string; toolId: string; config: PromptConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoDownloadUrl, setVideoDownloadUrl] = useState<string>('');
  
  const [tConf, setTConf] = useState<TextOverlayConfig>({
    mainTitle: analysis?.productName || '时尚新品',
    subTitle: analysis?.style || '典雅风格',
    price: '¥299',
    promoBadge: 'NEW',
    detailInfo: [analysis.productName, analysis.materials, analysis.style, analysis.season].filter(Boolean) as string[],
    sellingPointTexts: analysis.sellingPoints || ['精选用料', '匠心工艺'],
    sceneTitle: analysis.brandName || 'FASHION BRAND',
    sceneSubtitle: analysis.posterTheme || '探索无限可能'
  });

  const labels: Record<string, string> = {
    main: '商品主图 (Square)',
    detail: '细节展示 (Detail)',
    sellingPoint: '卖点海报 (Hero)',
    scene: '氛围场景 (Lifestyle)'
  };

  const [previewUrl, setPreviewUrl] = useState<string>('');

  const drawCanvas = useCallback(() => {
    if (!imgSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
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

  const handleGenerateVideo = async () => {
    if (!imgSrc || !canvasRef.current) return;
    setIsVideoGenerating(true);
    setVideoUrl(''); // Reset previous video
    setVideoDownloadUrl('');
    try {
      // Create a temporary canvas to draw the raw image WITHOUT any text overlays
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const cleanImgData = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(tempCanvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => {
          reject(new Error('Failed to load raw image to generate video'));
        };
        img.src = imgSrc;
      });

      const { videoUrl, downloadUrl } = await generateVideo(cleanImgData, userId, toolId, analysis, config);
      setVideoUrl(videoUrl);
      setVideoDownloadUrl(downloadUrl);
    } catch (err: any) {
      console.error('Video generation failed', err);
      alert(`视频生成失败: ${err.message}`);
    } finally {
      setIsVideoGenerating(false);
    }
  };

  const downloadImage = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `${type}-master.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  return (
    <div className={`transition-all duration-700 flex flex-col lg:flex-row gap-8 items-start justify-center ${(isVideoGenerating || videoUrl) ? 'max-w-6xl' : 'max-w-lg'} mx-auto mb-20`}>
      {/* Image Card Container */}
      <div className="w-full max-w-lg animate-in zoom-in-95 duration-700">
        <div className="bg-white dark:bg-slate-900 rounded-[48px] p-4 shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-slate-800">
          <div className="aspect-[3/4] relative rounded-[40px] overflow-hidden bg-slate-50 dark:bg-slate-950 group">
            {imgSrc ? (
              <>
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-6 backdrop-blur-sm">
                  <div className="flex gap-4">
                    <Button size="icon" variant="secondary" className="w-14 h-14 rounded-2xl shadow-xl shadow-black/20" onClick={() => setIsPreviewOpen(true)}>
                      <Maximize2 className="w-6 h-6" />
                    </Button>
                    <Button size="icon" variant="secondary" className="w-14 h-14 rounded-2xl shadow-xl shadow-black/20" onClick={() => setIsEditOpen(true)}>
                      <Edit2 className="w-6 h-6" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="w-14 h-14 rounded-2xl shadow-xl shadow-black/20 overflow-hidden relative group/btn" 
                      disabled={isVideoGenerating}
                      onClick={handleGenerateVideo}
                    >
                      {isVideoGenerating ? (
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      ) : (
                        <Video className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3 w-full px-12">
                    <Button variant="default" className="rounded-full w-full h-12 font-bold shadow-xl shadow-primary/20" onClick={downloadImage}>
                      <Download className="w-4 h-4 mr-2" />
                      下载最终成品
                    </Button>
                    {type === 'scene' && (
                      <Button 
                        variant="secondary" 
                        className="rounded-full w-full h-12 font-bold shadow-xl shadow-black/10 bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-md"
                        disabled={isVideoGenerating}
                        onClick={handleGenerateVideo}
                      >
                        {isVideoGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            正在生成展示视频...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            生成产品展示视频
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                </div>
                <span className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-300 animate-pulse">正在渲染中</span>
              </div>
            )}
          </div>
          
          <div className="py-6 px-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1 leading-none">画布类型</span>
              <span className="text-xl font-black tracking-tight">{labels[type]}</span>
            </div>
            <div className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Premium Output</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side Video Panel */}
      {(isVideoGenerating || videoUrl) && (
        <div className="w-full max-w-lg lg:mt-0 animate-in slide-in-from-right-20 duration-700">
          <div className="bg-slate-900 rounded-[48px] p-4 shadow-2xl shadow-black/50 border border-slate-800 overflow-hidden">
            <div className="aspect-[3/4] relative rounded-[40px] overflow-hidden bg-black flex flex-col items-center justify-center">
              {videoUrl ? (
                <>
                  <video 
                    src={videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    controls 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-6 left-6 z-10">
                    <div className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
                       <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                       <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Video Rendered</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-white">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Video className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Veo 引擎渲染中</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px] text-center leading-relaxed">
                    正在基于光影追踪进行动态视频合成，这可能需要 30-60 秒...
                  </p>
                </div>
              )}
            </div>

            <div className="py-6 px-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 leading-none">渲染引擎</span>
                <span className="text-xl font-black tracking-tight text-white">Google Veo 3.1</span>
              </div>
              {videoUrl && (
                <Button 
                  size="icon"
                  className="w-12 h-12 rounded-full shadow-xl shadow-primary/20" 
                  onClick={() => window.open(`${videoDownloadUrl || videoUrl}&download=1`, '_blank')}
                >
                  <Download className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          
          {videoUrl && (
            <div className="mt-6 p-6 bg-primary/10 rounded-3xl border border-primary/20 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-primary mb-1">生成成功！</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                动态视频已合成完毕。您可以保存此 5 秒的产品展示样片用于社交媒体投放。
              </p>
            </div>
          )}
        </div>
      )}

      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] w-auto h-auto flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {imgSrc && (
              <img 
                src={previewUrl || imgSrc} 
                alt="Preview" 
                className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300" 
              />
            )}
            <Button 
              variant="secondary"
              size="icon"
              className="absolute -top-4 -right-4 md:top-6 md:right-6 w-12 h-12 rounded-full shadow-2xl border border-white/10 backdrop-blur-md bg-black/40 hover:bg-black/60 text-white transition-all hover:scale-105 z-[110]"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-[32px] p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight">内容排版微调</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2 max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">基础信息</h4>
              <EditableTextField label="主标题" value={tConf.mainTitle} onChange={(v) => setTConf({...tConf, mainTitle: v})} />
              <EditableTextField label="副标题" value={tConf.subTitle} onChange={(v) => setTConf({...tConf, subTitle: v})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">价格策略</h4>
                <EditableTextField label="价格" value={tConf.price} onChange={(v) => setTConf({...tConf, price: v})} />
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">促销标识</h4>
                <EditableTextField label="徽标" value={tConf.promoBadge} onChange={(v) => setTConf({...tConf, promoBadge: v})} />
              </div>
            </div>

            {type === 'detail' && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">参数面板</h4>
                <EditableTextField 
                  label="详情列表 (逗号分隔)" 
                  value={tConf.detailInfo.join(', ')} 
                  onChange={(v) => setTConf({...tConf, detailInfo: v.split(',').map(s=>s.trim())})} 
                />
              </div>
            )}
            
            {type === 'sellingPoint' && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">卖点内容</h4>
                <EditableTextField 
                  label="核心卖点 (逗号分隔)" 
                  value={tConf.sellingPointTexts.join(', ')} 
                  onChange={(v) => setTConf({...tConf, sellingPointTexts: v.split(',').map(s=>s.trim())})} 
                />
              </div>
            )}
            
            {type === 'scene' && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">品牌心智</h4>
                <EditableTextField label="品牌名" value={tConf.sceneTitle} onChange={(v) => setTConf({...tConf, sceneTitle: v})} />
                <EditableTextField label="品牌 Slogan" value={tConf.sceneSubtitle} onChange={(v) => setTConf({...tConf, sceneSubtitle: v})} />
              </div>
            )}
          </div>
          <div className="flex justify-end pt-8 mt-4 border-t">
            <Button onClick={() => setIsEditOpen(false)} className="rounded-full px-10 h-12 font-bold shadow-lg shadow-primary/20">
              更新排版预览
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
