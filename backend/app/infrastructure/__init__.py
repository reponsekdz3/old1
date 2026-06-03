"""Infrastructure module for scalability and high-availability."""

from .scalability import (
    ShardManager, ShardingStrategy, CacheManager, ConnectionPoolManager,
    LoadBalancer, CDNManager, MessageQueue, MetricsCollector,
    AutoScalingManager, DataPartitioning
)

__all__ = [
    'ShardManager',
    'ShardingStrategy', 
    'CacheManager',
    'ConnectionPoolManager',
    'LoadBalancer',
    'CDNManager',
    'MessageQueue',
    'MetricsCollector',
    'AutoScalingManager',
    'DataPartitioning',
]
