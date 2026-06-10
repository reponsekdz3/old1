/**
 * ProgressiveImage — blur-to-HD image loading.
 * 1. Immediately shows a tiny blurred placeholder (low-res thumb or CSS blur).
 * 2. Loads the full-res image off-screen.
 * 3. Fades it in once loaded, removing the blur.
 *
 * On low bandwidth (detected via bwManager), the HD load is deferred or skipped.
 */
import React, { useState, useEffect, useRef } from 'react';
import { bwManager } from '../utils/bandwidth';

export default function ProgressiveImage({
  src,
  thumb,           // tiny placeholder (data-url, 20px blur) — optional
  alt = '',
  className = '',
  style = {},
  onClick,
  width,
  height,
}) {
  const [phase, setPhase]       = useState('blur');   // 'blur' | 'loading' | 'hd'
  const [quality, setQuality]   = useState(bwManager.quality);
  const [hdLoaded, setHdLoaded] = useState(false);
  const [error, setError]       = useState(false);
  const imgRef = useRef(null);

  // Track bandwidth changes
  useEffect(() => {
    const off = bwManager.onChange(q => setQuality(q));
    return off;
  }, []);

  // Trigger HD load when visible (IntersectionObserver)
  useEffect(() => {
    if (!src || quality === 'minimal') return;
    setHdLoaded(false);
    setPhase('blur');
    setError(false);

    const el = imgRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('loading');
          obs.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src, quality]);

  const placeholder = thumb || null;

  const containerStyle = {
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-block',
    width,
    height,
    backgroundColor: '#f3f4f6',
    ...style,
  };

  return (
    <div style={containerStyle} className={className} onClick={onClick}>

      {/* ── Blur placeholder ── */}
      {!hdLoaded && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: placeholder
              ? `url("${placeholder}") center/cover no-repeat`
              : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
            filter: placeholder ? 'blur(12px) saturate(1.2)' : 'none',
            transform: 'scale(1.05)',
            transition: 'opacity 0.4s ease',
            opacity: hdLoaded ? 0 : 1,
          }}
        >
          {!placeholder && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #d1d5db',
              borderTopColor: '#9ca3af', animation: 'spin 1s linear infinite' }} />
          )}
        </div>
      )}

      {/* ── HD image ── */}
      {phase !== 'blur' && !error && (
        <img
          src={src}
          alt={alt}
          ref={imgRef}
          onLoad={() => { setHdLoaded(true); setPhase('hd'); }}
          onError={() => setError(true)}
          draggable={false}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
            opacity: hdLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />
      )}

      {/* Anchor for IntersectionObserver when not yet loading */}
      {phase === 'blur' && <div ref={imgRef} style={{ position: 'absolute', inset: 0 }} />}

      {/* ── Error state ── */}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
          <span style={{ fontSize: 24 }}>🖼️</span>
          <span>Failed to load</span>
        </div>
      )}

      {/* Spinner during HD load */}
      {phase === 'loading' && !hdLoaded && !error && (
        <div style={{ position: 'absolute', bottom: 4, right: 4, width: 16, height: 16,
          borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)',
          borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
