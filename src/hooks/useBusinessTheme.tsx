import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function applyThemeColors(hex: string) {
  const hsl = hexToHSL(hex);
  if (!hsl) return;
  const { h, s, l } = hsl;
  const root = document.documentElement;

  // Primary color family
  root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
  root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
  root.style.setProperty('--rose-gold', `${h} ${s}% ${l}%`);
  root.style.setProperty('--rose-gold-light', `${h} ${Math.max(s - 2, 5)}% ${Math.min(l + 13, 90)}%`);
  root.style.setProperty('--rose-gold-glow', `${h} ${Math.min(s + 5, 100)}% ${Math.min(l + 7, 85)}%`);
  root.style.setProperty('--dusty-rose', `${h} ${Math.max(s - 5, 10)}% ${Math.max(l - 5, 30)}%`);
  root.style.setProperty('--dusty-rose-dark', `${h} ${Math.max(s - 8, 10)}% ${Math.max(l - 20, 20)}%`);

  // Accent / secondary tones
  root.style.setProperty('--accent', `${h} ${Math.max(s - 8, 5)}% ${Math.min(l + 23, 95)}%`);
  root.style.setProperty('--secondary', `${h} ${Math.max(s - 12, 5)}% ${Math.min(l + 26, 95)}%`);
  root.style.setProperty('--muted', `${h} ${Math.max(s - 18, 5)}% ${Math.min(l + 28, 96)}%`);
  root.style.setProperty('--border', `${h} ${Math.max(s - 15, 5)}% ${Math.min(l + 22, 92)}%`);
  root.style.setProperty('--input', `${h} ${Math.max(s - 15, 5)}% ${Math.min(l + 22, 92)}%`);

  // Background tones (very light tint of primary)
  root.style.setProperty('--background', `${h} ${Math.max(s - 10, 5)}% 96%`);
  root.style.setProperty('--card', `${h} ${Math.max(s - 12, 5)}% 98%`);
  root.style.setProperty('--popover', `${h} ${Math.max(s - 12, 5)}% 98%`);
  root.style.setProperty('--cream', `${h} ${Math.max(s - 10, 5)}% 95%`);
  root.style.setProperty('--warm-beige', `${h} ${Math.max(s - 12, 5)}% 89%`);

  // Sidebar
  root.style.setProperty('--sidebar-background', `${h} ${Math.max(s - 12, 5)}% 96%`);
  root.style.setProperty('--sidebar-primary', `${h} ${s}% ${l}%`);
  root.style.setProperty('--sidebar-accent', `${h} ${Math.max(s - 12, 5)}% 91%`);
  root.style.setProperty('--sidebar-border', `${h} ${Math.max(s - 15, 5)}% 87%`);
  root.style.setProperty('--sidebar-ring', `${h} ${s}% ${l}%`);

  // Gradient overrides
  const prim = `hsl(${h} ${s}% ${l}%)`;
  const glow = `hsl(${h} ${Math.min(s + 5, 100)}% ${Math.min(l + 7, 85)}%)`;
  const dark = `hsl(${h} ${Math.max(s - 5, 10)}% ${Math.max(l - 5, 30)}%)`;
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${prim}, ${glow})`);
  root.style.setProperty('--gradient-soft', `linear-gradient(135deg, hsl(${h} ${Math.max(s - 10, 5)}% 95%), hsl(${h} ${Math.max(s - 8, 5)}% 88%))`);
  root.style.setProperty('--gradient-hero', `linear-gradient(180deg, ${dark}, ${prim}, hsl(${h} ${Math.max(s - 2, 5)}% ${Math.min(l + 5, 80)}%))`);
}

function extractDominantColor(imgElement: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const size = 50;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(imgElement, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    rSum += r; gSum += g; bSum += b; count++;
  }
  if (count === 0) return null;
  const rAvg = Math.round(rSum / count);
  const gAvg = Math.round(gSum / count);
  const bAvg = Math.round(bSum / count);
  return `#${rAvg.toString(16).padStart(2, '0')}${gAvg.toString(16).padStart(2, '0')}${bAvg.toString(16).padStart(2, '0')}`;
}

export function applyThemeFromImage(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const hex = extractDominantColor(img);
      if (hex) applyThemeColors(hex);
      resolve(hex);
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

let cachedLogoUrl: string | null = null;

export function getLogoUrl() {
  return cachedLogoUrl;
}

export function useBusinessTheme() {
  const [logoUrl, setLogoUrl] = useState<string | null>(cachedLogoUrl);
  const [ready, setReady] = useState(!!cachedLogoUrl);

  useEffect(() => {
    if (cachedLogoUrl) { setReady(true); return; }

    (async () => {
      try {
        // Check if saved color exists in business_settings
        const { data: settings } = await supabase
          .from('business_settings')
          .select('primary_color')
          .limit(1)
          .single();

        // Fetch logo
        const { data: files } = await supabase.storage.from('gallery').list('', { search: 'logo' });
        const logoFile = files?.find(f => f.name.startsWith('logo'));
        if (logoFile) {
          const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(logoFile.name);
          const url = urlData.publicUrl + '?t=' + logoFile.updated_at;
          cachedLogoUrl = url;
          setLogoUrl(url);

          // Apply colors from logo image
          await applyThemeFromImage(url);
        } else if (settings?.primary_color) {
          // Fallback: use saved color
          applyThemeColors(settings.primary_color);
        }
      } catch (e) {
        // Ignore — use defaults
      }
      setReady(true);
    })();
  }, []);

  return { logoUrl, ready };
}
