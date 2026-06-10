import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiClock, FiTrash2, FiCalendar, FiSend, FiEdit2, FiCheck } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format, isPast, addMinutes } from 'date-fns';

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleMessageModal({ receiverId, receiverName, onClose, onScheduled }) {
  const [tab, setTab] = useState('new'); // new | list
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(addMinutes(new Date(), 30)));
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const minDatetime = toLocalInputValue(addMinutes(new Date(), 1));

  const loadScheduled = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/messages/scheduled?status=all');
      setScheduled(data.scheduled || []);
    } catch {}
    setLoadingList(false);
  };

  useEffect(() => { if (tab === 'list') loadScheduled(); }, [tab]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!content.trim()) { toast.error('Enter a message'); return; }
    const selectedDate = new Date(scheduledAt);
    if (isPast(selectedDate)) { toast.error('Choose a future time'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/messages/schedule', {
        receiver_id: receiverId,
        content: content.trim(),
        scheduled_at: selectedDate.toISOString(),
      });
      toast.success('Message scheduled!');
      setContent('');
      setScheduledAt(toLocalInputValue(addMinutes(new Date(), 30)));
      onScheduled?.(data.scheduled);
      loadScheduled();
      setTab('list');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to schedule');
    }
    setSending(false);
  };

  const handleCancel = async (id) => {
    try {
      await api.delete(`/messages/scheduled/${id}`);
      toast.success('Scheduled message cancelled');
      setScheduled(s => s.map(m => m.id === id ? { ...m, status: 'cancelled' } : m));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to cancel');
    }
  };

  const statusColor = {
    pending: 'text-blue-500 bg-blue-50',
    sent: 'text-green-600 bg-green-50',
    cancelled: 'text-gray-400 bg-gray-100',
    failed: 'text-red-500 bg-red-50',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FiClock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Schedule Message</h3>
                {receiverName && <p className="text-white/70 text-sm">To: {receiverName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
              <FiX size={20} />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-white/10 rounded-xl p-1">
            <button onClick={() => setTab('new')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'new' ? 'bg-white text-[#075E54]' : 'text-white/80 hover:text-white'}`}>
              New
            </button>
            <button onClick={() => setTab('list')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'list' ? 'bg-white text-[#075E54]' : 'text-white/80 hover:text-white'}`}>
              Scheduled
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            {tab === 'new' ? (
              <motion.form key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Message</label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="What do you want to say?"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                    maxLength={4096}
                  />
                  <p className="text-right text-xs text-gray-300 mt-1">{content.length}/4096</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <FiCalendar size={12} /> Send At
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={minDatetime}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] text-gray-700"
                  />
                </div>

                {/* Quick time presets */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">Quick presets</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '30 min', mins: 30 },
                      { label: '1 hour', mins: 60 },
                      { label: '3 hours', mins: 180 },
                      { label: 'Tomorrow 9am', custom: 'tomorrow_9am' },
                      { label: 'Next week', custom: 'next_week' },
                    ].map(p => (
                      <button key={p.label} type="button"
                        className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600 hover:bg-[#25D366]/10 hover:text-[#25D366] transition"
                        onClick={() => {
                          if (p.mins) {
                            setScheduledAt(toLocalInputValue(addMinutes(new Date(), p.mins)));
                          } else if (p.custom === 'tomorrow_9am') {
                            const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
                            setScheduledAt(toLocalInputValue(d));
                          } else if (p.custom === 'next_week') {
                            const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
                            setScheduledAt(toLocalInputValue(d));
                          }
                        }}
                      >{p.label}</button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={sending || !content.trim()}
                  className="w-full bg-[#25D366] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#1fbd5a] transition">
                  {sending ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <><FiClock size={16} /> Schedule Message</>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {loadingList ? (
                  <div className="flex justify-center py-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full" />
                  </div>
                ) : scheduled.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FiClock size={28} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No scheduled messages</p>
                    <p className="text-gray-400 text-sm mt-1">Create one from the "New" tab</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {scheduled.map(msg => (
                      <div key={msg.id} className="border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 font-medium truncate">{msg.content || '[attachment]'}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <FiCalendar size={10} />
                                {msg.scheduled_at ? format(new Date(msg.scheduled_at), 'MMM d, yyyy HH:mm') : '—'}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[msg.status] || 'text-gray-500'}`}>
                                {msg.status}
                              </span>
                            </div>
                            {msg.receiver_name && (
                              <p className="text-xs text-gray-400 mt-1">To: {msg.receiver_name}</p>
                            )}
                          </div>
                          {msg.status === 'pending' && (
                            <button onClick={() => handleCancel(msg.id)}
                              className="flex-shrink-0 p-1.5 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg transition">
                              <FiTrash2 size={15} />
                            </button>
                          )}
                          {msg.status === 'sent' && (
                            <FiCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
