import { layoutCloud, type CloudWord, type LayoutOptions, type PlacedWord } from './layout';
import type { MaskGrid } from '@/lib/mask/mask';

export type LayoutRequest = {
  id: number;
  mask: MaskGrid;
  words: CloudWord[];
  widths: Record<string, number>;
  options: LayoutOptions;
};

export type LayoutResponse = { id: number; placed: PlacedWord[]; ms: number };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<LayoutRequest>) => void) | null;
  postMessage: (msg: LayoutResponse) => void;
};

scope.onmessage = (e) => {
  const { id, mask, words, widths, options } = e.data;
  const t0 = performance.now();
  const placed = layoutCloud(mask, words, widths, options);
  scope.postMessage({ id, placed, ms: performance.now() - t0 });
};
