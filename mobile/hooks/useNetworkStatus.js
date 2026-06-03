import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns current network status.
 * { isOnline: bool, connectionType: string }
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState({ isOnline: true, connectionType: 'unknown' });

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(state => {
      setStatus({
        isOnline: state.isConnected && state.isInternetReachable !== false,
        connectionType: state.type,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setStatus({
        isOnline: state.isConnected && state.isInternetReachable !== false,
        connectionType: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return status;
}
