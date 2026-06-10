/**
 * VipChat Adaptive Bandwidth Manager
 * Detects connection quality in real time and adjusts all resource loading accordingly.
 * Quality levels: 'high' | 'medium' | 'low' | 'minimal'
 */

const QUALITY_LEVELS = { high: 4, medium: 3, low: 2, minimal: 1 };

class BandwidthManager {
  constructor() {
    this.quality = 'high';
    this.rtt = 0;
    this.downlink = Infinity;
    this._listeners = new Set();
    this._init();
  }

  _init() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      this._update(conn);
      conn.addEventListener('change', () => this._update(conn));
    }
    // Also measure real RTT via a tiny probe
    this._probe();
    setInterval(() => this._probe(), 30_000);
  }

  _update(conn) {
    this.downlink = conn.downlink || Infinity;
    this.rtt      = conn.rtt      || 0;
    const ect     = conn.effectiveType || '4g';

    let q = 'high';
    if (ect === '2g' || this.downlink < 0.15 || this.rtt > 800)  q = 'minimal';
    else if (ect === '3g' || this.downlink < 1.5  || this.rtt > 400) q = 'low';
    else if (this.downlink < 5 || this.rtt > 150)                 q = 'medium';

    this._setQuality(q);
  }

  _probe() {
    const t0  = Date.now();
    const url = '/api/health?_=' + t0;
    fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(r => {
        const rtt = Date.now() - t0;
        this.rtt  = rtt;
        if (rtt > 800)       this._setQuality('minimal');
        else if (rtt > 400)  this._setQuality('low');
        else if (rtt > 150)  this._setQuality('medium');
        else                 this._setQuality('high');
      })
      .catch(() => {});
  }

  _setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this._listeners.forEach(fn => fn(q));
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  get isLow()     { return QUALITY_LEVELS[this.quality] <= 2; }
  get isMedium()  { return QUALITY_LEVELS[this.quality] === 3; }
  get isHigh()    { return this.quality === 'high'; }

  /** Return image URL variant matching current bandwidth */
  imageUrl(originalUrl, opts = {}) {
    if (!originalUrl) return originalUrl;
    const {} = opts;
    // If we serve via a CDN that supports quality params, append them.
    // For local /uploads/ files we just return the original — ProgressiveImage
    // handles the blur-to-HD transition itself.
    if (this.quality === 'minimal') return originalUrl; // ProgressiveImage shows thumb only
    if (this.quality === 'low')     return originalUrl;
    return originalUrl;
  }

  /** Compression hint for uploads (0-100) */
  get uploadQuality() {
    const map = { high: 92, medium: 75, low: 55, minimal: 35 };
    return map[this.quality];
  }

  /** Max video resolution for calls */
  get videoConstraints() {
    const map = {
      high:    { width: 1280, height: 720,  frameRate: 30 },
      medium:  { width: 640,  height: 480,  frameRate: 20 },
      low:     { width: 320,  height: 240,  frameRate: 15 },
      minimal: { width: 160,  height: 120,  frameRate: 10 },
    };
    return map[this.quality];
  }

  /** Max chunk size for file uploads */
  get chunkSize() {
    const map = { high: 2_097_152, medium: 524_288, low: 131_072, minimal: 32_768 };
    return map[this.quality];
  }
}

export const bwManager = new BandwidthManager();
export default bwManager;
