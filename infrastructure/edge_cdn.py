"""
Edge/CDN Infrastructure for Global Scale (500M+ Users)
- CloudFlare Workers for edge compute
- Geographic load balancing
- Smart caching strategies
- DDoS protection at edge
"""

import hashlib
import time
from typing import Dict, Optional
from functools import lru_cache

class EdgeNetwork:
    """Edge network configuration for global deployment"""
    
    REGIONS = {
        'na': ['us-east-1', 'us-west-2', 'ca-central-1'],
        'eu': ['eu-west-1', 'eu-central-1', 'eu-west-2'],
        'ap': ['ap-southeast-1', 'ap-northeast-1', 'ap-south-1'],
        'sa': ['sa-east-1'],
        'af': ['af-south-1'],
    }
    
    @staticmethod
    def get_nearest_edge(user_ip: str) -> str:
        """Route user to nearest edge location"""
        # Hash-based routing for demo
        hash_val = int(hashlib.md5(user_ip.encode()).hexdigest()[:8], 16)
        regions = list(EdgeNetwork.REGIONS.keys())
        return regions[hash_val % len(regions)]
    
    @staticmethod
    def get_edge_config() -> Dict:
        """Edge worker configuration"""
        return {
            'cache_ttl': {
                'static': 86400,
                'api': 5,
                'media': 3600,
            },
            'rate_limits': {
                'global': 100000,
                'per_ip': 1000,
            },
            'compression': ['br', 'gzip'],
        }


class CloudFlareWorker:
    """CloudFlare Worker script for edge processing"""
    
    WORKER_SCRIPT = """
// Edge Worker for VipChat
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const cache = caches.default
  
  // Check cache first
  let response = await cache.match(request)
  if (response) return response
  
  // Rate limiting
  const ip = request.headers.get('CF-Connecting-IP')
  const rateKey = `rate:${ip}`
  const rateCount = await KV.get(rateKey) || 0
  
  if (rateCount > 1000) {
    return new Response('Rate limited', { status: 429 })
  }
  
  await KV.put(rateKey, rateCount + 1, { expirationTtl: 60 })
  
  // Route to nearest origin
  const region = request.cf?.colo || 'LAX'
  const origin = ORIGINS[region] || DEFAULT_ORIGIN
  
  // Compress response
  response = await fetch(`${origin}${url.pathname}`, {
    headers: {
      'X-Edge-Location': region,
      'X-Request-ID': crypto.randomUUID(),
    }
  })
  
  // Clone for caching
  const responseToCache = response.clone()
  
  // Cache strategies
  if (url.pathname.startsWith('/static/')) {
    await cache.put(request, responseToCache)
  } else if (url.pathname.startsWith('/api/messages')) {
    // Very short cache for messages
    const headers = new Headers(responseToCache.headers)
    headers.set('Cache-Control', 'max-age=5')
    await cache.put(request, new Response(responseToCache.body, { ...responseToCache, headers }))
  }
  
  return response
}

const ORIGINS = {
  'LAX': 'https://us-west.vipchat.io',
  'IAD': 'https://us-east.vipchat.io',
  'FRA': 'https://eu-west.vipchat.io',
  'NRT': 'https://ap-northeast.vipchat.io',
}

const DEFAULT_ORIGIN = 'https://api.vipchat.io'
"""


class CDNConfig:
    """CDN configuration for static assets and media"""
    
    @staticmethod
    def get_cache_rules() -> list:
        return [
            {'pattern': '/static/*', 'ttl': 86400, 'compress': True},
            {'pattern': '/uploads/*', 'ttl': 3600, 'compress': True},
            {'pattern': '/api/messages', 'ttl': 5, 'compress': True},
            {'pattern': '/api/contacts', 'ttl': 60, 'compress': True},
        ]
    
    @staticmethod
    def get_image_optimization() -> Dict:
        return {
            'formats': ['webp', 'avif'],
            'quality': 75,
            'max_width': 1920,
            'lazy_load': True,
        }
