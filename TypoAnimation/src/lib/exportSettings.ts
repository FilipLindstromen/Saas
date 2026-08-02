import type { AspectRatio } from '@/types/project';
import { getCompositionSize } from '@/remotion/constants';

export type ExportQualityPreset = 'draft' | 'standard' | 'high';

export interface ExportRenderSettings {
  preset: ExportQualityPreset;
  scale: number;
  crf: number;
}

export const EXPORT_QUALITY_PRESETS: Record<
  ExportQualityPreset,
  { label: string; description: string; scale: number; crf: number }
> = {
  draft: {
    label: 'Draft',
    description: 'Faster export, smaller file — good for previews',
    scale: 0.75,
    crf: 26,
  },
  standard: {
    label: 'Standard',
    description: 'Balanced quality and file size (recommended)',
    scale: 1,
    crf: 23,
  },
  high: {
    label: 'High',
    description: 'Best quality, larger file and longer render',
    scale: 1,
    crf: 18,
  },
};

export function exportSettingsFromPreset(preset: ExportQualityPreset): ExportRenderSettings {
  const p = EXPORT_QUALITY_PRESETS[preset];
  return { preset, scale: p.scale, crf: p.crf };
}

export function exportOutputDimensions(aspectRatio: AspectRatio | undefined, scale: number) {
  const { width, height } = getCompositionSize(aspectRatio);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
