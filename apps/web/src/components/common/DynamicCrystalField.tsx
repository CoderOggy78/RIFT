import React, { useEffect, useRef } from 'react';

interface DotParticle {
  mode: 'orbit' | 'ambient';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
  orbitSpeed: number;
  orbitAngle: number;
  ambientSpeedX: number;
  ambientSpeedY: number;
  wobbleSpeedX: number;
  wobbleSpeedY: number;
  wobbleAmpX: number;
  wobbleAmpY: number;
  radius: number;
  color: string;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
  layer: 'bg' | 'mid' | 'fg';
}

export const DynamicCrystalField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth || 1440);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 680);

    // Track mouse coordinates for gentle repulsion
    const mouse = { x: -9999, y: -9999, radius: 140 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.parentElement?.clientWidth || window.innerWidth || 1440;
      height = canvas.parentElement?.clientHeight || 680;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Refined, subtle Antigravity palette (Google blues, teals, soft violet, subtle graphite)
    const palette = [
      '#1A73E8', // Precision Cobalt
      '#4285F4', // Sky Blue
      '#8AB4F8', // Soft Frost Blue
      '#34A853', // Emerald
      '#00BFA5', // Crisp Mint
      '#9333EA', // Cyber Violet
      '#A855F7', // Soft Orchid
      '#F28B82', // Soft Coral (muted, elegant)
      '#FBBC04', // Amber
      '#64748B', // Cool Slate
    ];

    // Constellation of tiny dots across the canvas
    const particleCount = 280;
    const particles: DotParticle[] = [];
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < particleCount; i++) {
      const layerRoll = Math.random();
      const layer: DotParticle['layer'] = layerRoll < 0.45 ? 'bg' : layerRoll < 0.82 ? 'mid' : 'fg';
      const mode: DotParticle['mode'] = Math.random() < 0.5 ? 'ambient' : 'orbit';
      const color = palette[Math.floor(Math.random() * palette.length)];

      // Tiny, subtle sizes (1px - 2.5px)
      let radius: number;
      let alpha: number;

      if (layer === 'bg') {
        radius = 0.8 + Math.random() * 0.7; // ~0.8px - 1.5px
        alpha = 0.16 + Math.random() * 0.22;
      } else if (layer === 'mid') {
        radius = 1.4 + Math.random() * 0.8; // ~1.4px - 2.2px
        alpha = 0.32 + Math.random() * 0.28;
      } else {
        radius = 2.0 + Math.random() * 0.8; // ~2.0px - 2.8px
        alpha = 0.55 + Math.random() * 0.35;
      }

      // Orbital parameters for subtle elliptical drift around center
      const maxReachX = Math.max(width * 0.54, 700);
      const maxReachY = Math.max(height * 0.54, 380);
      const orbitFactor = Math.pow(Math.random(), 0.6);
      const orbitRadiusX = 90 + orbitFactor * maxReachX;
      const orbitRadiusY = 60 + orbitFactor * maxReachY;
      const orbitAngle = Math.random() * Math.PI * 2;
      const speedDirection = Math.random() > 0.48 ? 1 : -1;
      const orbitSpeed = (0.0002 + Math.random() * 0.0008) * speedDirection;

      // Ambient full-bleed parameters
      const ambientStartX = Math.random() * width;
      const ambientStartY = Math.random() * height;
      const ambientSpeedX = (Math.random() - 0.5) * 0.22;
      const ambientSpeedY = (Math.random() - 0.5) * 0.18;

      const initX = mode === 'orbit' ? centerX + Math.cos(orbitAngle) * orbitRadiusX : ambientStartX;
      const initY = mode === 'orbit' ? centerY + Math.sin(orbitAngle) * orbitRadiusY : ambientStartY;

      particles.push({
        mode,
        baseX: initX,
        baseY: initY,
        x: initX,
        y: initY,
        orbitRadiusX,
        orbitRadiusY,
        orbitSpeed,
        orbitAngle,
        ambientSpeedX,
        ambientSpeedY,
        wobbleSpeedX: 0.006 + Math.random() * 0.015,
        wobbleSpeedY: 0.006 + Math.random() * 0.015,
        wobbleAmpX: 6 + Math.random() * 16,
        wobbleAmpY: 4 + Math.random() * 12,
        radius,
        color,
        alpha,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.012 + Math.random() * 0.024,
        layer,
      });
    }

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const currentCenterX = width / 2;
      const currentCenterY = height / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.pulsePhase += p.pulseSpeed;

        const wobbleX = Math.sin(time * p.wobbleSpeedX + i) * p.wobbleAmpX;
        const wobbleY = Math.cos(time * p.wobbleSpeedY + i) * p.wobbleAmpY;

        let targetX = p.baseX;
        let targetY = p.baseY;

        if (p.mode === 'orbit') {
          p.orbitAngle += p.orbitSpeed;
          const dynamicScaleX = Math.max(1, width / 1440);
          targetX = currentCenterX + Math.cos(p.orbitAngle) * (p.orbitRadiusX * dynamicScaleX) + wobbleX;
          targetY = currentCenterY + Math.sin(p.orbitAngle) * p.orbitRadiusY + wobbleY;

          p.baseX += (targetX - p.baseX) * 0.05;
          p.baseY += (targetY - p.baseY) * 0.05;
        } else {
          p.baseX += p.ambientSpeedX;
          p.baseY += p.ambientSpeedY;

          if (p.baseX < -20) p.baseX = width + 20;
          if (p.baseX > width + 20) p.baseX = -20;
          if (p.baseY < -20) p.baseY = height + 20;
          if (p.baseY > height + 20) p.baseY = -20;

          targetX = p.baseX + wobbleX;
          targetY = p.baseY + wobbleY;
        }

        // Gentle repulsion from mouse pointer
        const dx = mouse.x - p.baseX;
        const dy = mouse.y - p.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius && dist > 0) {
          const force = (1 - dist / mouse.radius) * (p.layer === 'fg' ? 40 : 25);
          const angle = Math.atan2(dy, dx);
          p.x = p.baseX - Math.cos(angle) * force;
          p.y = p.baseY - Math.sin(angle) * force;
        } else {
          p.x += (targetX - p.x) * 0.08;
          p.y += (targetY - p.y) * 0.08;
        }

        // Subtle shimmer / breathing
        const shimmer = 0.75 + Math.sin(p.pulsePhase) * 0.25;
        const currentAlpha = Math.max(0.08, Math.min(0.9, p.alpha * shimmer));

        // Draw crisp tiny dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ touchAction: 'none' }}
      aria-hidden="true"
    />
  );
};
