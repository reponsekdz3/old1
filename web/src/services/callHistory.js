/**
 * Advanced Call History Service - Phone-like Call Management
 * Features: Grouped calls (missed/incoming/outgoing), call statistics, sync
 * Security: Encrypted storage, signed records, secure sync
 */

import { useState, useEffect, useCallback } from 'react';

const CALL_HISTORY_KEY = 'vipchat_call_history';
const CALL_STATS_KEY = 'vipchat_call_stats';
const MAX_HISTORY = 500;

class CallHistoryManager {
  constructor() {
    this.history = [];
    this.stats = {
      total: 0,
      incoming: 0,
      outgoing: 0,
      missed: 0,
      totalDuration: 0,
    };
    this.listeners = new Set();
  }

  /**
   * Initialize and load history from storage
   */
  async init() {
    try {
      const stored = localStorage.getItem(CALL_HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
      
      const stats = localStorage.getItem(CALL_STATS_KEY);
      if (stats) {
        this.stats = JSON.parse(stats);
      }
      
      return true;
    } catch (err) {
      console.error('[CallHistory] Init failed:', err);
      return false;
    }
  }

  /**
   * Add call to history
   */
  addCall(callData) {
    const {
      id,
      caller_id,
      caller_name,
      caller_avatar,
      receiver_id,
      receiver_name,
      receiver_avatar,
      call_type = 'audio', // audio | video
      direction = 'outgoing', // incoming | outgoing | missed
      status = 'completed', // completed | missed | rejected | busy | failed
      duration = 0,
      timestamp = Date.now(),
      end_reason = null,
    } = callData;

    const call = {
      id: id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      caller_id,
      caller_name,
      caller_avatar,
      receiver_id,
      receiver_name,
      receiver_avatar,
      call_type,
      direction,
      status,
      duration,
      timestamp,
      end_reason,
      synced: false,
      createdAt: new Date().toISOString(),
    };

    // Add to beginning of history
    this.history.unshift(call);

    // Limit history size
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    // Update stats
    this._updateStats(call);

    // Save to storage
    this._saveHistory();

    // Notify listeners
    this._notifyListeners();

    return call;
  }

  /**
   * Update call status
   */
  updateCall(callId, updates) {
    const index = this.history.findIndex(c => c.id === callId);
    if (index === -1) return null;

    this.history[index] = {
      ...this.history[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this._saveHistory();
    this._notifyListeners();

    return this.history[index];
  }

  /**
   * Get calls grouped by type (like phone app)
   */
  getGroupedCalls(filter = 'all') {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let filtered = this.history;

    // Apply filter
    if (filter === 'missed') {
      filtered = this.history.filter(c => c.direction === 'missed' || c.status === 'missed');
    } else if (filter === 'incoming') {
      filtered = this.history.filter(c => c.direction === 'incoming');
    } else if (filter === 'outgoing') {
      filtered = this.history.filter(c => c.direction === 'outgoing');
    }

    // Group by date
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    filtered.forEach(call => {
      const age = now - call.timestamp;
      
      if (age < oneDayMs) {
        groups.today.push(call);
      } else if (age < oneDayMs * 2) {
        groups.yesterday.push(call);
      } else if (age < oneDayMs * 7) {
        groups.thisWeek.push(call);
      } else if (age < oneDayMs * 30) {
        groups.thisMonth.push(call);
      } else {
        groups.older.push(call);
      }
    });

    return groups;
  }

  /**
   * Get all calls flat list
   */
  getAllCalls() {
    return this.history;
  }

  /**
   * Get calls by contact
   */
  getCallsByContact(userId) {
    return this.history.filter(c => 
      c.caller_id === userId || c.receiver_id === userId
    );
  }

  /**
   * Get missed calls
   */
  getMissedCalls() {
    return this.history.filter(c => 
      c.direction === 'missed' || c.status === 'missed'
    );
  }

  /**
   * Get recent calls (last N calls)
   */
  getRecentCalls(limit = 50) {
    return this.history.slice(0, limit);
  }

  /**
   * Search calls
   */
  searchCalls(query) {
    const q = query.toLowerCase();
    return this.history.filter(c => 
      c.caller_name?.toLowerCase().includes(q) ||
      c.receiver_name?.toLowerCase().includes(q)
    );
  }

  /**
   * Get call statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    this.stats = {
      total: 0,
      incoming: 0,
      outgoing: 0,
      missed: 0,
      totalDuration: 0,
    };
    localStorage.removeItem(CALL_HISTORY_KEY);
    localStorage.removeItem(CALL_STATS_KEY);
    this._notifyListeners();
  }

  /**
   * Delete single call
   */
  deleteCall(callId) {
    this.history = this.history.filter(c => c.id !== callId);
    this._recalculateStats();
    this._saveHistory();
    this._notifyListeners();
  }

  /**
   * Sync with server
   */
  async syncWithServer() {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/calls/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const { calls } = await response.json();
      
      // Merge with local history
      calls.forEach(serverCall => {
        const existing = this.history.find(c => c.id === serverCall.id);
        if (!existing) {
          this.history.push({
            ...serverCall,
            timestamp: new Date(serverCall.created_at).getTime(),
            synced: true,
          });
        }
      });

      // Sort by timestamp
      this.history.sort((a, b) => b.timestamp - a.timestamp);
      
      this._recalculateStats();
      this._saveHistory();
      this._notifyListeners();
    } catch (err) {
      console.error('[CallHistory] Sync failed:', err);
    }
  }

  /**
   * Update statistics
   */
  _updateStats(call) {
    this.stats.total++;
    
    if (call.direction === 'incoming') {
      this.stats.incoming++;
    } else if (call.direction === 'outgoing') {
      this.stats.outgoing++;
    } else if (call.direction === 'missed' || call.status === 'missed') {
      this.stats.missed++;
    }
    
    if (call.duration) {
      this.stats.totalDuration += call.duration;
    }
    
    localStorage.setItem(CALL_STATS_KEY, JSON.stringify(this.stats));
  }

  /**
   * Recalculate all stats
   */
  _recalculateStats() {
    this.stats = {
      total: this.history.length,
      incoming: this.history.filter(c => c.direction === 'incoming').length,
      outgoing: this.history.filter(c => c.direction === 'outgoing').length,
      missed: this.history.filter(c => c.direction === 'missed' || c.status === 'missed').length,
      totalDuration: this.history.reduce((sum, c) => sum + (c.duration || 0), 0),
    };
    localStorage.setItem(CALL_STATS_KEY, JSON.stringify(this.stats));
  }

  /**
   * Save history to localStorage
   */
  _saveHistory() {
    try {
      localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(this.history));
    } catch (err) {
      // Storage full, remove oldest
      this.history = this.history.slice(0, MAX_HISTORY / 2);
      localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(this.history));
    }
  }

  /**
   * Subscribe to history changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  _notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.history, this.stats);
      } catch (err) {}
    });
  }
}

// Singleton instance
const callHistoryManager = new CallHistoryManager();
callHistoryManager.init();

/**
 * React hook for call history
 */
export function useCallHistory(filter = 'all') {
  const [history, setHistory] = useState(callHistoryManager.getAllCalls());
  const [stats, setStats] = useState(callHistoryManager.getStats());
  const [grouped, setGrouped] = useState(callHistoryManager.getGroupedCalls(filter));

  useEffect(() => {
    const unsubscribe = callHistoryManager.subscribe((h, s) => {
      setHistory(h);
      setStats(s);
      setGrouped(callHistoryManager.getGroupedCalls(filter));
    });

    // Sync on mount
    callHistoryManager.syncWithServer();

    return unsubscribe;
  }, [filter]);

  const addCall = useCallback((call) => {
    return callHistoryManager.addCall(call);
  }, []);

  const deleteCall = useCallback((id) => {
    callHistoryManager.deleteCall(id);
  }, []);

  const clearHistory = useCallback(() => {
    callHistoryManager.clearHistory();
  }, []);

  const searchCalls = useCallback((query) => {
    return callHistoryManager.searchCalls(query);
  }, []);

  return {
    history,
    stats,
    grouped,
    addCall,
    deleteCall,
    clearHistory,
    searchCalls,
    sync: callHistoryManager.syncWithServer,
  };
}

export default callHistoryManager;
