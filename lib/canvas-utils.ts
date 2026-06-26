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
  
  // Dynamic scale factor based on design base of 800px width
  const baseWidth = 800;
  const scale = width / baseWidth;
  
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

  // Helper to draw a badge with centered text
  const drawBadge = (text: string, x: number, y: number, w: number, h: number, bgColor: string, textColor: string, fontSize: number, weight: string = 'bold') => {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6 * scale);
    ctx.fill();
    setFont(fontSize, weight);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic'; // restore default
  };

  // Helper to draw multi-line wrapped text with ellipsis limit
  const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number, color: string, fontSize: number, weight: string = 'normal') => {
    setFont(fontSize, weight);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    
    // Split into characters (works perfectly for both Chinese and English)
    const words = text.split('');
    let line = '';
    let lines: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        lines.push(line);
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line) {
      lines.push(line);
    }
    
    // Limit to maxLines and add ellipsis if truncated
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.length > 3) {
          lines[lines.length - 1] = lastLine.slice(0, -2) + '...';
        }
      }
    }
    
    lines.forEach((l, idx) => {
      ctx.fillText(l, x, y + (idx * lineHeight));
    });
    
    return lines.length;
  };

  switch (type) {
    case 'main': {
      // Bottom Gradient
      const gradH = 180 * scale;
      const gradientBg = ctx.createLinearGradient(0, height - gradH, 0, height);
      gradientBg.addColorStop(0, 'rgba(0,0,0,0)');
      gradientBg.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, height - gradH, width, gradH);
      
      // Promo badge top left
      if (config.promoBadge) {
        drawBadge(config.promoBadge, 30 * scale, 30 * scale, 120 * scale, 42 * scale, '#fa8c16', '#fff', 18 * scale, 'bold');
      }

      // Title and price at bottom
      setFont(32 * scale, 'bold');
      drawText(config.mainTitle, 30 * scale, height - 75 * scale, '#fff');
      
      setFont(16 * scale);
      drawText(config.subTitle, 30 * scale, height - 40 * scale, '#ccc');
      
      setFont(36 * scale, 'bold');
      drawText(config.price, width - 30 * scale, height - 55 * scale, '#fa8c16', 'right');
      break;
    }
    case 'detail': {
      // 1. Elegant Top-Left Designer Badge
      const badgeW = 160 * scale;
      const badgeH = 42 * scale;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(30 * scale, 30 * scale, badgeW, badgeH, 12 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();

      setFont(11 * scale, 'bold');
      drawText('DETAIL SHOTS', 30 * scale + (badgeW / 2), 48 * scale, '#fa8c16', 'center');
      setFont(9 * scale, 'normal');
      drawText('• 细节展示', 30 * scale + (badgeW / 2), 62 * scale, '#fff', 'center');

      // 2. High-end Spec Sheet Card (Glassmorphism Sidebar Card)
      const cardW = 280 * scale;
      const cardH = 340 * scale;
      const cardX = width - cardW - 30 * scale;
      const cardY = (height - cardH) / 2;

      // Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24 * scale);
      ctx.fill();
      
      // Card subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      // Card Header
      setFont(10 * scale, 'bold');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'left';
      ctx.fillText('GARMENT SPECIFICATIONS', cardX + 24 * scale, cardY + 36 * scale);

      // Card Divider Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(cardX + 24 * scale, cardY + 48 * scale);
      ctx.lineTo(cardX + cardW - 24 * scale, cardY + 48 * scale);
      ctx.stroke();

      // Detail specs
      const labels = ['FABRIC & STYLE', 'MATERIAL SPEC', 'COLLECTION', 'SEASON'];
      const defaultInfo = ['匠心剪裁', '高端用料', '典雅风范', '四季通用'];
      
      for (let i = 0; i < 4; i++) {
        const itemY = cardY + 70 * scale + (i * 62 * scale);
        const valueText = config.detailInfo[i] || defaultInfo[i];

        // Label
        setFont(9 * scale, 'bold');
        ctx.fillStyle = '#fa8c16';
        ctx.textAlign = 'left';
        ctx.fillText(labels[i], cardX + 24 * scale, itemY);

        // Value text (use drawWrappedText)
        const textMaxW = cardW - 48 * scale;
        const textY = itemY + 18 * scale;
        drawWrappedText(
          valueText, 
          cardX + 24 * scale, 
          textY, 
          textMaxW, 
          16 * scale, // line height
          2,          // max lines
          '#ffffff', 
          13 * scale, // font size
          'bold'
        );
      }
      break;
    }
    case 'sellingPoint': {
      // 1. Premium Lookbook Header overlay at the top (Modern magazine format)
      // Subtle background scrim
      const scrimH = 160 * scale;
      const scrim = ctx.createLinearGradient(0, 0, 0, scrimH);
      scrim.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
      scrim.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, scrimH);

      // Title & Brand Label
      setFont(11 * scale, 'bold');
      drawText('PREMIUM BRAND CAMPAIGN', 30 * scale, 40 * scale, '#fa8c16');
      
      setFont(26 * scale, 'bold');
      drawText(config.mainTitle, 30 * scale, 78 * scale, '#ffffff');

      // Thin elegant separator line
      ctx.strokeStyle = 'rgba(250, 140, 22, 0.3)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(30 * scale, 96 * scale);
      ctx.lineTo(180 * scale, 96 * scale);
      ctx.stroke();

      setFont(11 * scale, 'normal');
      drawText('EXCLUSIVE COMFORT & TIMELESS AESTHETIC', 30 * scale, 114 * scale, '#cccccc');

      // 2. Sophisticated Bottom Pill Badges for Selling Points
      // Subtle bottom dark gradient
      const bottomScrimH = 180 * scale;
      const bottomScrim = ctx.createLinearGradient(0, height - bottomScrimH, 0, height);
      bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
      bottomScrim.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, height - bottomScrimH, width, bottomScrimH);

      config.sellingPointTexts.forEach((pt, idx) => {
        if (!pt) return;
        const y = height - 50 * scale - (idx * 45 * scale);

        // Calculate size dynamically
        setFont(13 * scale, 'bold');
        const textWidth = ctx.measureText(pt).width;
        const badgeWidth = textWidth + 50 * scale; // padding on each side
        const badgeHeight = 32 * scale;

        // Draw pill with translucent brand tint
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(30 * scale, y - 16 * scale, badgeWidth, badgeHeight, 16 * scale);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(250, 140, 22, 0.6)';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        // Draw an elegant small custom orange check circle
        ctx.fillStyle = '#fa8c16';
        ctx.beginPath();
        ctx.arc(44 * scale, y, 7 * scale, 0, Math.PI * 2);
        ctx.fill();

        // White tick inside the circle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.moveTo(41 * scale, y);
        ctx.lineTo(43 * scale, y + 2 * scale);
        ctx.lineTo(47 * scale, y - 2 * scale);
        ctx.stroke();

        // Write selling point text
        setFont(13 * scale, 'bold');
        drawText(pt, 58 * scale, y + 4 * scale, '#ffffff');
      });
      break;
    }
    case 'scene': {
      // Bottom Gradient
      const gradientH = 200 * scale;
      const gradientBg = ctx.createLinearGradient(0, height - gradientH, 0, height);
      gradientBg.addColorStop(0, 'rgba(0,0,0,0)');
      gradientBg.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, height - gradientH, width, gradientH);

      setFont(32 * scale, 'bold');
      drawText(config.sceneTitle, width / 2, height - 80 * scale, '#fff', 'center');
      setFont(16 * scale);
      drawText(config.sceneSubtitle, width / 2, height - 40 * scale, '#ccc', 'center');
      break;
    }
  }
}
