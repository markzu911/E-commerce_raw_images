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

export function drawTextOverlay(
  canvas: HTMLCanvasElement,
  type: string,
  config: TextOverlayConfig
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Basic Text render setup
  const setFont = (fontSize: number, weight: string = 'normal') => {
    ctx.font = `${weight} ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  };

  // Helper for drawing text with optional backdrop
  const drawText = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  switch (type) {
    case 'main': {
      // Bottom Gradient
      const gradientBg = ctx.createLinearGradient(0, height - 150, 0, height);
      gradientBg.addColorStop(0, 'rgba(0,0,0,0)');
      gradientBg.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, height - 150, width, 150);
      
      // Promo badge top left
      ctx.fillStyle = '#ff4d4f';
      ctx.fillRect(20, 20, 100, 40);
      setFont(20, 'bold');
      drawText(config.promoBadge, 70, 47, '#fff', 'center');

      // Title and price at bottom
      setFont(36, 'bold');
      drawText(config.mainTitle, 20, height - 60, '#fff');
      setFont(24);
      drawText(config.subTitle, 20, height - 30, '#ccc');
      setFont(40, 'bold');
      drawText(config.price, width - 20, height - 40, '#ff4d4f', 'right');
      break;
    }
    case 'detail': {
      // Top left 'Detail' badge
      ctx.fillStyle = '#000';
      ctx.fillRect(20, 20, 140, 40);
      setFont(20, 'bold');
      drawText('细节展示 DETAIL', 90, 47, '#fff', 'center');

      // Detail info
      const gradientBg = ctx.createLinearGradient(width - 250, 0, width, 0);
      gradientBg.addColorStop(0, 'rgba(0,0,0,0)');
      gradientBg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(width - 250, 0, 250, height);
      
      setFont(20);
      config.detailInfo.forEach((info, idx) => {
        drawText(info, width - 20, 100 + (idx * 40), '#fff', 'right');
      });
      break;
    }
    case 'sellingPoint': {
      // Top background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, 80);
      setFont(32, 'bold');
      drawText(config.mainTitle, 30, 52, '#fff');

      // Bottom orange badges
      config.sellingPointTexts.forEach((pt, idx) => {
        const y = height - 60 - (idx * 50);
        ctx.fillStyle = '#fa8c16';
        ctx.beginPath();
        ctx.roundRect(20, y - 25, 180, 35, 10);
        ctx.fill();
        setFont(18, 'bold');
        drawText('✓ ' + pt, 110, y - 2, '#fff', 'center');
      });
      break;
    }
    case 'scene': {
      // Bottom Gradient
      const gradientBg = ctx.createLinearGradient(0, height - 200, 0, height);
      gradientBg.addColorStop(0, 'rgba(0,0,0,0)');
      gradientBg.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, height - 200, width, 200);

      setFont(48, 'bold');
      drawText(config.sceneTitle, width / 2, height - 80, '#fff', 'center');
      setFont(24);
      drawText(config.sceneSubtitle, width / 2, height - 40, '#ccc', 'center');
      break;
    }
  }
}
