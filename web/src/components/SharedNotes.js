import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFileText, FiPlus, FiSave, FiTrash2, FiClock, FiUser,
  FiX, FiChevronRight, FiGlobe, FiLock, FiRotateCcw, FiEdit3,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function timeAgo(iso) {
  if (!iso) return '';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function NoteEditor({ note, chatWithId, groupId, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isPublic, setIsPublic] = useState(note?.is_public || false);
  const [saving, setSaving] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const textareaRef = useRef(null);
  const saveTimeout = useRef(null);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const autoSave = useCallback((newContent) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (!note?.id) return;
      try {
        await api.put(`/notes/${note.id}`, { content: newContent });
      } catch {}
    }, 2000);
  }, [note?.id]);

  const loadRevisions = async () => {
    if (!note?.id) return;
    const r = await api.get(`/notes/${note.id}/revisions`);
    setRevisions(r.data.revisions);
    setShowRevisions(true);
  };

  const restoreRevision = async (version) => {
    if (!note?.id) return;
    const r = await api.post(`/notes/${note.id}/revisions/${version}/restore`);
    setContent(r.data.note.content);
    setShowRevisions(false);
    toast.success('Revision restored');
  };

  const save = async () => {
    if (!title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      if (note?.id) {
        await api.put(`/notes/${note.id}`, { title, content, is_public: isPublic });
        toast.success('Note saved');
      } else {
        await api.post('/notes', { title, content, is_public: isPublic, chat_with_id: chatWithId, group_id: groupId });
        toast.success('Note created');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-white"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-100">
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <FiX size={15} />
        </button>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title…"
          className="flex-1 text-base font-black text-gray-900 outline-none placeholder:text-gray-300" />
        <div className="flex items-center gap-2">
          {note?.id && (
            <button onClick={loadRevisions}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" title="History">
              <FiClock size={13} className="text-gray-500" />
            </button>
          )}
          <button onClick={() => setIsPublic(p => !p)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isPublic ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            {isPublic ? <FiGlobe size={11} /> : <FiLock size={11} />}
            {isPublic ? 'Public' : 'Private'}
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-60">
            <FiSave size={12} />
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <textarea ref={textareaRef} value={content}
          onChange={e => { setContent(e.target.value); autoSave(e.target.value); }}
          placeholder="Start writing your note…

You can use markdown formatting:
**bold** _italic_ `code`
# Heading
- List item
> Quote"
          className="flex-1 p-5 text-sm text-gray-800 resize-none outline-none font-mono leading-relaxed"
        />
      </div>

      {note && (
        <div className="px-5 pb-safe flex items-center gap-2 py-2 border-t border-gray-50">
          <FiUser size={11} className="text-gray-300" />
          <p className="text-xs text-gray-400">
            v{note.version} · Last edited {timeAgo(note.updated_at)}
            {note.last_editor_name && ` by ${note.last_editor_name}`}
          </p>
        </div>
      )}

      {/* Revision history sheet */}
      <AnimatePresence>
        {showRevisions && (
          <motion.div className="absolute inset-0 bg-white z-10 flex flex-col"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}>
            <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-100">
              <button onClick={() => setShowRevisions(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
              <h2 className="font-black text-gray-900">Version History</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {revisions.map(rev => (
                <div key={rev.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Version {rev.version}</p>
                    <p className="text-xs text-gray-400">{rev.editor_name} · {timeAgo(rev.created_at)}</p>
                  </div>
                  <button onClick={() => restoreRevision(rev.version)}
                    className="flex items-center gap-1 text-xs font-bold text-[#25D366] bg-green-50 px-3 py-1.5 rounded-xl">
                    <FiRotateCcw size={11} /> Restore
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SharedNotes({ chatWithId, groupId, userId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editNote, setEditNote] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [open, setOpen] = useState(false);

  const loadNotes = useCallback(() => {
    const params = new URLSearchParams();
    if (chatWithId) params.set('chat_with_id', chatWithId);
    if (groupId) params.set('group_id', groupId);
    api.get(`/notes?${params}`)
      .then(r => setNotes(r.data.notes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatWithId, groupId]);

  useEffect(() => {
    if (open) loadNotes();
  }, [open, loadNotes]);

  const deleteNote = async (note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    await api.delete(`/notes/${note.id}`);
    toast.success('Note deleted');
    loadNotes();
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition">
        <FiFileText size={13} />
        Notes {notes.length > 0 ? `(${notes.length})` : ''}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex flex-col bg-white"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-lg">Shared Notes</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNew(true)}
                  className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-xl text-xs font-bold">
                  <FiPlus size={13} /> New
                </button>
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="space-y-3">
                  {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <FiFileText size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-gray-500 mb-1">No notes yet</p>
                  <p className="text-sm text-center mb-5">Create a shared wiki for this conversation</p>
                  <button onClick={() => setShowNew(true)}
                    className="bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                    Create First Note
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => (
                    <motion.div key={note.id} layout
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <button className="w-full text-left p-4" onClick={() => { setEditNote(note); }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-black text-gray-900 truncate">{note.title}</p>
                              {note.is_public ? (
                                <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">Public</span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">Private</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{note.content?.slice(0, 80) || 'Empty note'}</p>
                          </div>
                          <FiChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-gray-400">v{note.version}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(note.updated_at)}</span>
                          <span className="text-[10px] text-gray-400">by {note.last_editor_name || note.owner_name}</span>
                        </div>
                      </button>
                      <div className="border-t border-gray-50 px-4 py-2 flex justify-end">
                        <button onClick={() => deleteNote(note)}
                          className="text-xs text-red-400 font-bold flex items-center gap-1 hover:text-red-600">
                          <FiTrash2 size={11} /> Delete
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {(editNote || showNew) && (
                <NoteEditor
                  note={editNote}
                  chatWithId={chatWithId}
                  groupId={groupId}
                  onSave={() => { setEditNote(null); setShowNew(false); loadNotes(); }}
                  onClose={() => { setEditNote(null); setShowNew(false); }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
