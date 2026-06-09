import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  Alert, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../services/store';
import api from '../../services/api';
import { COLORS } from '../../config';

const ACCENT = '#25D366';
const DARK = '#111b21';

function BalanceCard({ balance, currency, onAdd, onSend, onWithdraw }) {
  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceBg} />
      <Text style={styles.balanceLabel}>Available Balance</Text>
      <Text style={styles.balanceAmount}>
        {currency || 'USD'} {parseFloat(balance || 0).toFixed(2)}
      </Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onAdd}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onSend}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="send-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onWithdraw}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="download-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Withdraw</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TxnRow({ txn }) {
  const isCredit = txn.type === 'topup' || txn.type === 'receive';
  const statusColor = txn.status === 'completed' ? '#25D366' : txn.status === 'failed' ? '#ef4444' : '#f59e0b';
  const iconName = isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline';
  return (
    <View style={styles.txnRow}>
      <View style={[styles.txnIcon, { backgroundColor: isCredit ? '#dcfce7' : '#fef2f2' }]}>
        <Ionicons name={iconName} size={22} color={isCredit ? '#16a34a' : '#dc2626'} />
      </View>
      <View style={styles.txnInfo}>
        <Text style={styles.txnDesc} numberOfLines={1}>{txn.description || txn.type}</Text>
        <Text style={styles.txnDate}>{new Date(txn.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.txnRight}>
        <Text style={[styles.txnAmount, { color: isCredit ? '#16a34a' : '#dc2626' }]}>
          {isCredit ? '+' : '-'}${parseFloat(txn.amount || 0).toFixed(2)}
        </Text>
        <Text style={[styles.txnStatus, { color: statusColor }]}>{txn.status}</Text>
      </View>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showTopup, setShowTopup] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const [topupAmount, setTopupAmount] = useState('');
  const [topupMethod, setTopupMethod] = useState('stripe');
  const [sendAmount, setSendAmount] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const [walletRes, txnRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions?limit=30'),
      ]);
      setWallet(walletRes.data);
      setTransactions(txnRes.data.transactions || []);
    } catch (e) {
      console.error('Wallet fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchWallet(); }, [fetchWallet]));

  const handleTopup = async () => {
    if (!topupAmount || parseFloat(topupAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post('/wallet/topup/stripe/create', {
        amount: parseFloat(topupAmount),
        currency: 'usd',
      });
      setShowTopup(false);
      Alert.alert('Top-Up Initiated', 'Complete payment in your browser: ' + (res.data?.checkout_url || ''));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Top-up failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!sendAmount || !sendPhone) {
      Alert.alert('Missing Info', 'Enter recipient phone and amount.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/wallet/send', {
        recipient_phone: sendPhone,
        amount: parseFloat(sendAmount),
        note: 'Sent via VipChat mobile',
      });
      setShowSend(false);
      setSendAmount(''); setSendPhone('');
      Alert.alert('Sent!', `$${sendAmount} sent successfully.`);
      fetchWallet();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Send failed. Check balance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAccount) {
      Alert.alert('Missing Info', 'Enter amount and account details.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/wallet/withdraw', {
        amount: parseFloat(withdrawAmount),
        account_details: withdrawAccount,
        method: 'bank_transfer',
      });
      setShowWithdraw(false);
      setWithdrawAmount(''); setWithdrawAccount('');
      Alert.alert('Withdrawal Requested', 'Your withdrawal is being processed (1-3 business days).');
      fetchWallet();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Withdrawal failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: '#888', marginTop: 12, fontSize: 14 }}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWallet(); }} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <BalanceCard
          balance={wallet?.balance}
          currency={wallet?.currency}
          onAdd={() => setShowTopup(true)}
          onSend={() => setShowSend(true)}
          onWithdraw={() => setShowWithdraw(true)}
        />

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Sent', value: wallet?.total_sent || 0, icon: 'arrow-up-circle', color: '#ef4444' },
            { label: 'Received', value: wallet?.total_received || 0, icon: 'arrow-down-circle', color: '#16a34a' },
            { label: 'Pending', value: wallet?.pending || 0, icon: 'time-outline', color: '#f59e0b' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={20} color={s.color} />
              <Text style={styles.statValue}>${parseFloat(s.value).toFixed(2)}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Add money to get started</Text>
            </View>
          ) : (
            transactions.map(txn => <TxnRow key={txn.id} txn={txn} />)
          )}
        </View>
      </ScrollView>

      {/* Top-Up Modal */}
      <Modal visible={showTopup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Money</Text>
            <Text style={styles.modalSub}>Choose payment method and amount</Text>
            <View style={styles.methodRow}>
              {[
                { id: 'stripe', label: 'Card', icon: 'card-outline' },
                { id: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
                { id: 'flutterwave', label: 'Mobile', icon: 'phone-portrait-outline' },
                { id: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
              ].map(m => (
                <TouchableOpacity key={m.id} onPress={() => setTopupMethod(m.id)}
                  style={[styles.methodBtn, topupMethod === m.id && styles.methodBtnActive]}>
                  <Ionicons name={m.icon} size={22} color={topupMethod === m.id ? '#fff' : '#666'} />
                  <Text style={[styles.methodLabel, topupMethod === m.id && { color: '#fff' }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Amount (USD)"
              placeholderTextColor="#aaa"
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[styles.primaryBtn, actionLoading && { opacity: 0.7 }]} onPress={handleTopup} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Continue →</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTopup(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Send Modal */}
      <Modal visible={showSend} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Send Money</Text>
            <Text style={styles.modalSub}>Send to any VipChat user instantly</Text>
            <TextInput style={styles.input} placeholder="Recipient phone number" placeholderTextColor="#aaa"
              value={sendPhone} onChangeText={setSendPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Amount (USD)" placeholderTextColor="#aaa"
              value={sendAmount} onChangeText={setSendAmount} keyboardType="decimal-pad" />
            <TouchableOpacity style={[styles.primaryBtn, actionLoading && { opacity: 0.7 }]} onPress={handleSend} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Now</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSend(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={showWithdraw} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Withdraw Funds</Text>
            <Text style={styles.modalSub}>Withdraw to your bank or mobile money</Text>
            <TextInput style={styles.input} placeholder="Amount to withdraw (USD)" placeholderTextColor="#aaa"
              value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="decimal-pad" />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Account details (bank name, account number, etc.)" placeholderTextColor="#aaa"
              value={withdrawAccount} onChangeText={setWithdrawAccount} multiline />
            <TouchableOpacity style={[styles.primaryBtn, actionLoading && { opacity: 0.7 }]} onPress={handleWithdraw} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Request Withdrawal</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowWithdraw(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  balanceCard: {
    backgroundColor: COLORS.primary,
    margin: 16,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceBg: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  balanceAmount: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 4, marginBottom: 24, letterSpacing: -0.5 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: '#111', marginTop: 2 },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 24, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12 },
  txnIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txnInfo: { flex: 1, minWidth: 0 },
  txnDesc: { fontSize: 13, fontWeight: '700', color: '#222' },
  txnDate: { fontSize: 11, color: '#aaa', marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: '800' },
  txnStatus: { fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#555' },
  emptySubtext: { fontSize: 13, color: '#aaa' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 20 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  methodBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: 'transparent' },
  methodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  methodLabel: { fontSize: 11, fontWeight: '700', color: '#555' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 15, color: '#111', marginBottom: 12, fontWeight: '600' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: 14 },
  cancelText: { color: '#888', fontSize: 14, fontWeight: '600' },
});
