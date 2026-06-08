/**
 * Web Security Utilities
 * Client-side security helpers for XSS prevention, CSP, and secure communication
 */

class WebSecurityManager {
  constructor() {
    this.cspNonce = null;
    this.requestId = 0;
  }

  /**
   * Initialize security features
   */
  initialize() {
    // Get CSP nonce from meta tag
    const nonceMeta = document.querySelector('meta[name="csp-nonce"]');
    if (nonceMeta) {
      this.cspNonce = nonceMeta.content;
    }

    // Setup security headers
    this.setupSecurityHeaders();
    
    // Monitor for XSS attempts
    this.setupXSSMonitoring();
    
    console.log('[WebSecurity] Initialized');
  }

  /**
   * Setup default security headers for fetch
   */
  setupSecurityHeaders() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      let [url, options = {}] = args;
      
      options.headers = options.headers || {};
      
      // Add security headers
      options.headers['X-Requested-With'] = 'XMLHttpRequest';
      options.headers['X-Client-Version'] = '1.0.0';
      options.headers['X-Request-ID'] = this.generateRequestId();
      
      // Add CSRF token for state-changing requests
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
        const csrfToken = this.getCSRFToken();
        if (csrfToken) {
          options.headers['X-CSRF-Token'] = csrfToken;
        }
      }
      
      return originalFetch(url, options);
    };
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    this.requestId++;
    return `${Date.now()}-${this.requestId}`;
  }

  /**
   * Get CSRF token from cookie or localStorage
   */
  getCSRFToken() {
    // Try cookie first
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    if (match) return match[1];
    
    // Try localStorage
    return localStorage.getItem('csrf_token');
  }

  /**
   * Set CSRF token
   */
  setCSRFToken(token) {
    localStorage.setItem('csrf_token', token);
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input, maxLength = 4000) {
    if (typeof input !== 'string') return input;
    
    // Remove control characters
    input = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Limit length
    input = input.substring(0, maxLength);
    
    // Escape HTML
    return this.sanitizeHTML(input);
  }

  /**
   * Validate URL to prevent open redirect
   */
  validateURL(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      
      // Only allow same origin or whitelisted domains
      const allowedOrigins = [
        window.location.origin,
        'https://api.vipchat.com',
        'https://cdn.vipchat.com'
      ];
      
      return allowedOrigins.some(origin => parsed.origin === origin);
    } catch {
      return false;
    }
  }

  /**
   * Setup XSS monitoring
   */
  setupXSSMonitoring() {
    // Monitor for suspicious script injection attempts
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'SCRIPT' && !node.hasAttribute('nonce')) {
            console.warn('[WebSecurity] Suspicious script injection detected!');
            this.logSecurityEvent('XSS_ATTEMPT', {
              nodeName: node.nodeName,
              src: node.src,
              content: node.textContent?.substring(0, 100)
            });
            node.remove();
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(type, details) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      details
    };

    // Send to backend
    fetch('/api/security/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => {
      // Log locally if backend fails
      console.error('[WebSecurity] Security event:', event);
    });
  }

  /**
   * Encrypt sensitive data before storing in localStorage
   */
  async encryptData(data, key) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const keyBuffer = encoder.encode(key);

    // Generate key from password
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('vipchat-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      cryptoKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Encrypt
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      dataBuffer
    );

    // Return IV + encrypted data as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data from localStorage
   */
  async decryptData(encryptedData, key) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Generate key
    const keyBuffer = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('vipchat-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      cryptoKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      encrypted
    );

    return JSON.parse(decoder.decode(decrypted));
  }

  /**
   * Secure localStorage wrapper
   */
  secureStorage = {
    setItem: async (key, value, encryptionKey) => {
      if (encryptionKey) {
        const encrypted = await this.encryptData(value, encryptionKey);
        localStorage.setItem(`secure_${key}`, encrypted);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },

    getItem: async (key, encryptionKey) => {
      if (encryptionKey) {
        const encrypted = localStorage.getItem(`secure_${key}`);
        if (!encrypted) return null;
        return await this.decryptData(encrypted, encryptionKey);
      } else {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      }
    },

    removeItem: (key) => {
      localStorage.removeItem(key);
      localStorage.removeItem(`secure_${key}`);
    }
  };

  /**
   * Prevent clickjacking — skipped for Replit preview and known dev environments.
   */
  preventClickjacking() {
    if (window.self === window.top) return;
    try {
      const parentHost = window.top.location.hostname;
      // Allow Replit preview domains
      if (parentHost && (parentHost.endsWith('.replit.dev') || parentHost.endsWith('.repl.co') || parentHost.endsWith('.janeway.replit.dev'))) return;
    } catch {
      // Cross-origin — can't read parent hostname. Check our own host.
      const host = window.location.hostname;
      if (host.endsWith('.replit.dev') || host.endsWith('.repl.co') || host.endsWith('.janeway.replit.dev')) return;
    }
    console.warn('[WebSecurity] Clickjacking attempt detected!');
    this.logSecurityEvent('CLICKJACKING_ATTEMPT', {});
    try { window.top.location = window.self.location; } catch {}
  }

  /**
   * Clear all security data
   */
  clearSecurityData() {
    localStorage.removeItem('csrf_token');
    sessionStorage.clear();
    
    // Clear secure storage items
    Object.keys(localStorage)
      .filter(key => key.startsWith('secure_'))
      .forEach(key => localStorage.removeItem(key));
  }
}

// Singleton instance
const webSecurity = new WebSecurityManager();

// Initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      webSecurity.initialize();
      webSecurity.preventClickjacking();
    });
  } else {
    webSecurity.initialize();
    webSecurity.preventClickjacking();
  }
}

export default webSecurity;
