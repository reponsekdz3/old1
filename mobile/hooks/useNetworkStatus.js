/**
 * Advanced Network Status Hook
 * Monitors connectivity and manages offline/online transitions
 */
import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Cache } from '../services/cache';

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: true,
    isOffline: false,
    networkInfo: null,
    connectionHistory: [],
    offlineQueue: { size: 0, pending: 0, failed: 0 },
    lastSync: null,
    syncInProgress: false,
  });

  const lastConnectionState = useRef(true);
  const reconnectTimeout = useRef(null);
  const syncInterval = useRef(null);

  useEffect(() => {
    let mounted = true;

    // Initialize network monitoring
    const initializeNetworkMonitoring = async () => {
      // Get initial network state
      const state = await NetInfo.fetch();
      
      if (mounted) {
        updateNetworkStatus(state);
      }

      // Subscribe to network changes
      const unsubscribe = NetInfo.addEventListener((state) => {
        if (mounted) {
          updateNetworkStatus(state);
        }
      });

      return unsubscribe;
    };

    const unsubscribePromise = initializeNetworkMonitoring();

    // Setup periodic queue stats update
    syncInterval.current = setInterval(async () => {
      if (mounted) {
        await updateQueueStats();
      }
    }, 5000);

    return () => {
      mounted = false;
      
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, []);

  const updateNetworkStatus = async (state) => {
    const isConnected = state.isConnected && state.isInternetReachable;
    const wasConnected = lastConnectionState.current;
    
    // Update connection history
    const newHistoryEntry = {
      timestamp: Date.now(),
      status: isConnected ? 'online' : 'offline',
      type: state.type,
    };

    setNetworkStatus(prev => ({
      ...prev,
      isOnline: isConnected,
      isOffline: !isConnected,
      networkInfo: {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        strength: state.details?.strength || 0,
        isExpensive: state.details?.isConnectionExpensive || false,
      },
      connectionHistory: [
        newHistoryEntry,
        ...prev.connectionHistory.slice(0, 9) // Keep last 10 entries
      ],
    }));

    // Handle connection state changes
    if (!wasConnected && isConnected) {
      // Coming back online
      console.log('[NetworkStatus] Coming back online');
      handleComingOnline();
    } else if (wasConnected && !isConnected) {
      // Going offline
      console.log('[NetworkStatus] Going offline');
      handleGoingOffline();
    }

    lastConnectionState.current = isConnected;
  };

  const handleComingOnline = async () => {
    // Clear any pending reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Update sync status
    setNetworkStatus(prev => ({ ...prev, syncInProgress: true }));

    try {
      // Trigger sync with delay to avoid overwhelming the network
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sync offline queue
      await Cache.syncOfflineQueue();
      
      // Update last sync time
      setNetworkStatus(prev => ({
        ...prev,
        lastSync: Date.now(),
        syncInProgress: false,
      }));

      console.log('[NetworkStatus] Sync completed successfully');
    } catch (error) {
      console.error('[NetworkStatus] Sync failed:', error);
      
      setNetworkStatus(prev => ({ ...prev, syncInProgress: false }));
      
      // Retry sync after delay
      reconnectTimeout.current = setTimeout(() => {
        handleComingOnline();
      }, 5000);
    }
  };

  const handleGoingOffline = () => {
    console.log('[NetworkStatus] Handling offline transition');
    
    // Update queue stats immediately
    updateQueueStats();
    
    // Clear any pending sync
    setNetworkStatus(prev => ({ ...prev, syncInProgress: false }));
  };

  const updateQueueStats = async () => {
    try {
      const stats = await Cache.getQueueStats();
      
      setNetworkStatus(prev => ({
        ...prev,
        offlineQueue: {
          size: stats.total || 0,
          pending: stats.pending || 0,
          failed: stats.failed || 0,
        },
      }));
    } catch (error) {
      console.error('[NetworkStatus] Failed to get queue stats:', error);
    }
  };

  const forceSync = async () => {
    if (!networkStatus.isOnline || networkStatus.syncInProgress) {
      return false;
    }

    setNetworkStatus(prev => ({ ...prev, syncInProgress: true }));

    try {
      await Cache.syncOfflineQueue();
      
      setNetworkStatus(prev => ({
        ...prev,
        lastSync: Date.now(),
        syncInProgress: false,
      }));
      
      await updateQueueStats();
      return true;
    } catch (error) {
      console.error('[NetworkStatus] Force sync failed:', error);
      
      setNetworkStatus(prev => ({ ...prev, syncInProgress: false }));
      return false;
    }
  };

  const clearOfflineQueue = async () => {
    try {
      await Cache.clearOfflineQueue();
      await updateQueueStats();
      return true;
    } catch (error) {
      console.error('[NetworkStatus] Failed to clear queue:', error);
      return false;
    }
  };

  const getConnectionQuality = () => {
    if (!networkStatus.isOnline) return 'offline';
    
    const { networkInfo } = networkStatus;
    if (!networkInfo) return 'good';
    
    if (networkInfo.type === 'wifi') {
      return networkInfo.strength > 80 ? 'excellent' : 
             networkInfo.strength > 50 ? 'good' : 'poor';
    }
    
    if (networkInfo.type === 'cellular') {
      return networkInfo.strength > 70 ? 'excellent' :
             networkInfo.strength > 40 ? 'good' : 'poor';
    }
    
    return 'good';
  };

  const getTimeSinceLastSync = () => {
    if (!networkStatus.lastSync) return null;
    return Date.now() - networkStatus.lastSync;
  };

  const shouldShowOfflineIndicator = () => {
    return networkStatus.isOffline || 
           networkStatus.offlineQueue.pending > 0 ||
           networkStatus.syncInProgress;
  };

  return {
    ...networkStatus,
    connectionQuality: getConnectionQuality(),
    timeSinceLastSync: getTimeSinceLastSync(),
    shouldShowOfflineIndicator: shouldShowOfflineIndicator(),
    actions: {
      forceSync,
      clearOfflineQueue,
      updateQueueStats,
    },
  };
};
