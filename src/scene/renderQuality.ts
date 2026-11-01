export type RenderQuality = {
  compact: boolean;
  pixelRatio: number;
  antialias: boolean;
  usePostProcessing: boolean;
  samples: number;
  shadowMapSize: number;
  photoTextureWidth: number;
};

type QualityInput = {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
};

/**
 * Phones and short viewports use a lighter, direct rendering path. Desktop
 * retains the ambient occlusion and depth-of-field passes that sell the physical exhibition.
 */
export function selectRenderQuality({
  viewportWidth,
  viewportHeight,
  devicePixelRatio,
}: QualityInput): RenderQuality {
  const compact = viewportWidth < 760 || viewportHeight < 560;

  if (compact) {
    return {
      compact: true,
      pixelRatio: Math.min(devicePixelRatio, 1.4),
      antialias: true,
      usePostProcessing: false,
      samples: 0,
      shadowMapSize: 1024,
      photoTextureWidth: 768,
    };
  }

  return {
    compact: false,
    pixelRatio: Math.min(devicePixelRatio, 1.75),
    antialias: false,
    usePostProcessing: true,
    samples: 2,
    shadowMapSize: 2048,
    photoTextureWidth: 1280,
  };
}
