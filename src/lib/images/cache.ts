// Preload + decode images once, then hand out decoded <img> elements for drawImage.

type Entry = { img: HTMLImageElement | null; promise: Promise<HTMLImageElement | null>; failed: boolean };

export class ImageCache {
  private entries = new Map<string, Entry>();
  private queue: { url: string; resolve: (img: HTMLImageElement | null) => void }[] = [];
  private active = 0;
  private generation = 0;

  constructor(
    private readonly concurrency = 12,
    private readonly onLoad?: () => void,
  ) {}

  /** Decoded image, or undefined if it isn't ready yet (starts loading). */
  get(url: string): HTMLImageElement | undefined {
    if (!url) return undefined;
    const e = this.entries.get(url);
    if (e) return e.img ?? undefined;
    void this.load(url);
    return undefined;
  }

  isReady(url: string): boolean {
    return !!this.entries.get(url)?.img;
  }

  load(url: string, priority = false): Promise<HTMLImageElement | null> {
    const existing = this.entries.get(url);
    if (existing) return existing.promise;
    let resolve!: (img: HTMLImageElement | null) => void;
    const promise = new Promise<HTMLImageElement | null>((r) => (resolve = r));
    const entry: Entry = { img: null, promise, failed: false };
    this.entries.set(url, entry);
    // data: URLs (lqip) are instant; skip the network queue.
    if (url.startsWith('data:')) this.decode(url, entry, resolve);
    else if (priority) this.queue.unshift({ url, resolve });
    else this.queue.push({ url, resolve });
    this.pump();
    return promise;
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
    this.queue = [];
    this.active = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      const entry = this.entries.get(job.url);
      if (!entry) {
        job.resolve(null);
        continue;
      }
      this.active++;
      const gen = this.generation;
      this.decode(job.url, entry, (img) => {
        if (gen === this.generation) this.active--;
        job.resolve(img);
        this.pump();
      });
    }
  }

  private decode(url: string, entry: Entry, done: (img: HTMLImageElement | null) => void) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img
      .decode()
      .then(() => {
        entry.img = img;
        this.onLoad?.();
        done(img);
      })
      .catch(() => {
        entry.failed = true;
        // Allow a later retry (e.g. network blip).
        setTimeout(() => {
          if (this.entries.get(url) === entry) this.entries.delete(url);
        }, 5000);
        done(null);
      });
  }
}
