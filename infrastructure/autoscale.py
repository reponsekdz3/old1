"""
Auto-Scaling Infrastructure for 500M+ Concurrent Users
- Kubernetes Horizontal Pod Autoscaler (HPA)
- Redis Cluster for distributed state
- Database connection pooling
- Load balancer configuration
"""

import os
from typing import Dict, List

# Kubernetes HPA configuration
HPA_CONFIG = {
    'apiVersion': 'autoscaling/v2',
    'kind': 'HorizontalPodAutoscaler',
    'metadata': {
        'name': 'vipchat-backend-hpa',
        'namespace': 'vipchat'
    },
    'spec': {
        'scaleTargetRef': {
            'apiVersion': 'apps/v1',
            'kind': 'Deployment',
            'name': 'vipchat-backend'
        },
        'minReplicas': 10,
        'maxReplicas': 1000,
        'metrics': [
            {
                'type': 'Resource',
                'resource': {
                    'name': 'cpu',
                    'target': {
                        'type': 'Utilization',
                        'averageUtilization': 70
                    }
                }
            },
            {
                'type': 'Resource',
                'resource': {
                    'name': 'memory',
                    'target': {
                        'type': 'Utilization',
                        'averageUtilization': 80
                    }
                }
            },
            {
                'type': 'Pods',
                'pods': {
                    'metric': {
                        'name': 'websocket_connections'
                    },
                    'target': {
                        'type': 'AverageValue',
                        'averageValue': '10000'
                    }
                }
            }
        ],
        'behavior': {
            'scaleDown': {
                'stabilizationWindowSeconds': 300,
                'policies': [
                    {
                        'type': 'Percent',
                        'value': 10,
                        'periodSeconds': 60
                    }
                ]
            },
            'scaleUp': {
                'stabilizationWindowSeconds': 0,
                'policies': [
                    {
                        'type': 'Percent',
                        'value': 100,
                        'periodSeconds': 15
                    },
                    {
                        'type': 'Pods',
                        'value': 20,
                        'periodSeconds': 15
                    }
                ],
                'selectPolicy': 'Max'
            }
        }
    }
}

# Redis Cluster configuration
REDIS_CLUSTER_CONFIG = {
    'nodes': [
        {'host': 'redis-0.redis', 'port': 6379},
        {'host': 'redis-1.redis', 'port': 6379},
        {'host': 'redis-2.redis', 'port': 6379},
        {'host': 'redis-3.redis', 'port': 6379},
        {'host': 'redis-4.redis', 'port': 6379},
        {'host': 'redis-5.redis', 'port': 6379},
    ],
    'max_connections_per_node': 5000,
    'read_from_replicas': True,
    'retry_on_timeout': True,
    'cluster_down_retry_attempts': 3,
}

# Database connection pool
DATABASE_POOL_CONFIG = {
    'pool_size': 100,
    'max_overflow': 200,
    'pool_timeout': 30,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
    'echo': False,
}


class ScalabilityConfig:
    """Configuration for horizontal scaling"""
    
    @staticmethod
    def get_redis_cluster_url() -> str:
        nodes = REDIS_CLUSTER_CONFIG['nodes']
        return ','.join([f"{n['host']}:{n['port']}" for n in nodes])
    
    @staticmethod
    def get_database_url() -> str:
        return os.environ.get(
            'DATABASE_URL',
            'postgresql://vipchat:password@postgres:5432/vipchat'
        )
    
    @staticmethod
    def get_kafka_config() -> Dict:
        return {
            'bootstrap.servers': os.environ.get(
                'KAFKA_SERVERS',
                'kafka-0:9092,kafka-1:9092,kafka-2:9092'
            ),
            'client.id': 'vipchat-backend',
            'acks': 'all',
            'retries': 3,
            'batch.size': 16384,
            'linger.ms': 5,
            'buffer.memory': 33554432,
        }
    
    @staticmethod
    def get_connection_pool_config() -> Dict:
        return {
            'max_connections': 10000,
            'max_keepalive_connections': 5000,
            'keepalive_expiry': 30,
        }


class LoadBalancerConfig:
    """Load balancer configuration for 500M+ users"""
    
    @staticmethod
    def get_nginx_config() -> str:
        return """
upstream vipchat_backend {
    least_conn;
    server backend-0:8000 max_fails=3 fail_timeout=30s;
    server backend-1:8000 max_fails=3 fail_timeout=30s;
    server backend-2:8000 max_fails=3 fail_timeout=30s;
    keepalive 1000;
}

upstream vipchat_sfu {
    least_conn;
    server sfu-0:5000;
    server sfu-1:5000;
    server sfu-2:5000;
    keepalive 500;
}

server {
    listen 80;
    listen 443 ssl http2;
    
    client_max_body_size 100M;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/s;
    
    location /api/auth {
        limit_req zone=auth burst=20 nodelay;
        proxy_pass http://vipchat_backend;
    }
    
    location /api/ {
        limit_req zone=api burst=200 nodelay;
        proxy_pass http://vipchat_backend;
    }
    
    location /socket.io {
        proxy_pass http://vipchat_backend;
        proxy_read_timeout 86400;
    }
    
    location /sfu {
        proxy_pass http://vipchat_sfu;
    }
}
"""
    
    @staticmethod
    def get_haproxy_config() -> str:
        return """
global
    maxconn 100000
    daemon

defaults
    mode tcp
    timeout connect 10s
    timeout client 86400s
    timeout server 86400s

frontend http_front
    bind *:80
    bind *:443 ssl crt /etc/ssl/vipchat.pem
    
    acl is_websocket hdr(Upgrade) -i websocket
    use_backend websocket_back if is_websocket
    default_backend http_back

backend http_back
    balance leastconn
    option httpchk GET /api/health
    server backend-0 backend-0:8000 check inter 10s fall 3 rise 2
    server backend-1 backend-1:8000 check inter 10s fall 3 rise 2
    server backend-2 backend-2:8000 check inter 10s fall 3 rise 2

backend websocket_back
    balance leastconn
    option tcp-check
    server backend-0 backend-0:8000 check
    server backend-1 backend-1:8000 check
    server backend-2 backend-2:8000 check
"""


# Kubernetes deployment manifests
KUBERNETES_DEPLOYMENT = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vipchat-backend
  namespace: vipchat
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 50%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: vipchat-backend
  template:
    metadata:
      labels:
        app: vipchat-backend
    spec:
      containers:
      - name: backend
        image: vipchat/backend:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vipchat-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis:6379"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - vipchat-backend
              topologyKey: kubernetes.io/hostname
"""

# Prometheus monitoring
PROMETHEUS_CONFIG = """
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'vipchat-backend'
    kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
        - vipchat
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_label_app]
      action: keep
      regex: vipchat-backend
    - source_labels: [__meta_kubernetes_pod_ip]
      target_label: __address__
      replacement: ${1}:8000

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
  - static_configs:
    - targets:
      - alertmanager:9093
"""

# Grafana dashboard for monitoring
GRAFANA_DASHBOARD = {
    "dashboard": {
        "title": "VipChat Scalability Dashboard",
        "panels": [
            {
                "title": "Active WebSocket Connections",
                "targets": [{
                    "expr": "sum(vipchat_websocket_connections)"
                }]
            },
            {
                "title": "Messages per Second",
                "targets": [{
                    "expr": "rate(vipchat_messages_total[1m])"
                }]
            },
            {
                "title": "API Latency P99",
                "targets": [{
                    "expr": "histogram_quantile(0.99, rate(vipchat_api_latency_bucket[5m]))"
                }]
            },
            {
                "title": "Pod Count",
                "targets": [{
                    "expr": "count(kube_pod_info{pod=~'vipchat-backend.*'})"
                }]
            },
            {
                "title": "Redis Memory Usage",
                "targets": [{
                    "expr": "redis_memory_used_bytes / redis_memory_max_bytes * 100"
                }]
            }
        ]
    }
}
