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
      // 1. Elegant Top-Left Designer Badge
      const badgeW = 160;
      const badgeH = 40;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(30, 30, badgeW, badgeH, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      setFont(12, 'bold');
      drawText('DETAIL SHOTS', 30 + (badgeW / 2), 48, '#fa8c16', 'center');
      setFont(10, 'normal');
      drawText('• 细节展示', 30 + (badgeW / 2), 62, '#fff', 'center');

      // 2. High-end Spec Sheet Card (Glassmorphism Sidebar Card)
      const cardW = 260;
      const cardH = 320;
      const cardX = width - cardW - 30;
      const cardY = (height - cardH) / 2;

      // Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24);
      ctx.fill();
      // Card subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Card Header
      setFont(10, 'bold');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'left';
      ctx.fillText('GARMENT SPECIFICATIONS', cardX + 24, cardY + 36);

      // Card Divider Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(cardX + 24, cardY + 48);
      ctx.lineTo(cardX + cardW - 24, cardY + 48);
      ctx.stroke();

      // Detail specs
      const labels = ['FABRIC & STYLE', 'MATERIAL SPEC', 'COLLECTION', 'SEASON'];
      const defaultInfo = ['匠心剪裁', '高端用料', '典雅风范', '四季通用'];
      
      for (let i = 0; i < 4; i++) {
        const itemY = cardY + 75 + (i * 60);
        const valueText = config.detailInfo[i] || defaultInfo[i];

        // Label
        setFont(9, 'bold');
        ctx.fillStyle = '#fa8c16';
        ctx.textAlign = 'left';
        ctx.fillText(labels[i], cardX + 24, itemY);

        // Value text
        setFont(14, 'bold');
        ctx.fillStyle = '#ffffff';
        ctx.fillText(valueText.length > 18 ? valueText.slice(0, 17) + '...' : valueText, cardX + 24, itemY + 22);
      }
      break;
    }
    case 'sellingPoint': {
      // 1. Premium Lookbook Header overlay at the top (Modern magazine format)
      // Subtle background scrim
      const scrim = ctx.createLinearGradient(0, 0, 0, 160);
      scrim.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
      scrim.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, 160);

      // Title & Brand Label
      setFont(11, 'bold');
      drawText('PREMIUM BRAND CAMPAIGN', 30, 40, '#fa8c16');
      
      setFont(28, 'bold');
      drawText(config.mainTitle, 30, 78, '#ffffff');

      // Thin elegant separator line
      ctx.strokeStyle = 'rgba(25fa, 140, 22, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 96);
      ctx.lineTo(180, 96);
      ctx.stroke();

      setFont(11, 'normal');
      drawText('EXCLUSIVE COMFORT & TIMELESS AESTHETIC', 30, 114, '#cccccc');

      // 2. Sophisticated Bottom Pill Badges for Selling Points
      // Subtle bottom dark gradient
      const bottomScrim = ctx.createLinearGradient(0, height - 180, 0, height);
      bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
      bottomScrim.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, height - 180, width, 180);

      config.sellingPointTexts.forEach((pt, idx) => {
        if (!pt) return;
        const y = height - 50 - (idx * 45);

        // Calculate size dynamically
        setFont(13, 'bold');
        const textWidth = ctx.measureText(pt).width;
        const badgeWidth = textWidth + 60; // 30px padding on each side
        const badgeHeight = 32;

        // Draw pill with translucent brand tint
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(30, y - 16, badgeWidth, badgeHeight, 16);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(250, 140, 22, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw an elegant small custom orange check circle
        ctx.fillStyle = '#fa8c16';
        ctx.beginPath();
        ctx.arc(46, y, 7, 0, Math.PI * 2);
        ctx.fill();

        // White tick inside the circle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(43, y);
        ctx.lineTo(45, y + 2);
        ctx.lineTo(49, y - 2);
        ctx.stroke();

        // Write selling point text
        setFont(13, 'bold');
        drawText(pt, 62, y + 4, '#ffffff');
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
