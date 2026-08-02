import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const GOLD    = '#c9a84c';
const POLL_MS = 4000;

function formatTime(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T'));
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return sameDay ? hm : `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(-2).map(w => w[0]?.toUpperCase() || '').join('');
}

const AVATAR_COLORS = ['#7c6fa4','#4a7fa5','#5a9e78','#a07040','#8b5a5a','#4a8fa0','#a06070'];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState('');
  const [hoverId, setHoverId]     = useState(null);
  // keyboardOffset = bàn phím chiếm bao nhiêu px từ dưới lên (0 khi không có bàn phím)
  const [kbOffset, setKbOffset] = useState(0);

  const bottomRef = useRef(null);
  const sinceRef  = useRef(null);
  const inputRef  = useRef(null);
  const editRef   = useRef(null);
  const isMobile  = window.innerWidth < 1024;

  const scrollBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Theo dõi bàn phím iOS qua visualViewport
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      // window.innerHeight ổn định, vv.height co lại khi bàn phím hiện
      setKbOffset(Math.max(0, window.innerHeight - vv.height));
      scrollBottom(false);
      setTimeout(() => scrollBottom(false), 150);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [isMobile, scrollBottom]);

  // Load tin nhắn ban đầu
  useEffect(() => {
    api.getChatMessages().then(msgs => {
      setMessages(msgs);
      if (msgs.length) sinceRef.current = msgs[msgs.length - 1].created_at;
      setTimeout(() => scrollBottom(false), 50);
    }).catch(() => {});
  }, []);

  // Polling tin nhắn mới
  useEffect(() => {
    const t = setInterval(() => {
      api.getChatMessages(sinceRef.current).then(msgs => {
        if (!msgs.length) return;
        sinceRef.current = msgs[msgs.length - 1].created_at;
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = msgs.filter(m => !ids.has(m.id));
          if (!newMsgs.length) return prev;
          setTimeout(() => scrollBottom(true), 50);
          return [...prev, ...newMsgs];
        });
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true); setText('');
    try {
      const msg = await api.sendChatMessage(content);
      sinceRef.current = msg.created_at;
      setMessages(prev => [...prev, msg]);
      setTimeout(() => scrollBottom(true), 50);
    } catch (_) { setText(content); }
    finally { setSending(false); inputRef.current?.focus(); }
  }

  async function saveEdit(id) {
    const content = editText.trim();
    if (!content) return;
    try {
      const updated = await api.editChatMessage(id, content);
      setMessages(prev => prev.map(m => m.id === id ? updated : m));
    } catch (_) {}
    setEditingId(null);
  }

  async function deleteMsg(id) {
    if (!confirm('Xóa tin nhắn này?')) return;
    try {
      await api.deleteChatMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (_) {}
  }

  function startEdit(msg) {
    setEditingId(msg.id);
    setEditText(msg.content);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function onEditKey(e, id) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(id); }
    if (e.key === 'Escape') setEditingId(null);
  }

  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameUser = prev?.user_id === msg.user_id;
    const close = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 120000;
    acc.push({ ...msg, showName: !sameUser || !close, last: true });
    if (acc.length > 1) acc[acc.length - 2].last = !sameUser || !close;
    return acc;
  }, []);

  const isMe = (msg) => msg.user_id === user?.id;
  const canDelete = (msg) => isMe(msg) || user?.role === 'SUPER_ADMIN';

  const content = (
    <div style={{
      // Mobile: portal đến document.body → position fixed che toàn màn hình
      // Desktop: render bình thường trong Layout
      ...(isMobile ? {
        position: 'fixed',
        top: 0, left: 0, right: 0,
        bottom: kbOffset + 'px',   // co lên khi bàn phím xuất hiện
        zIndex: 200,
      } : {
        height: '100%',
      }),
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--bg-main)',
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 18px',
        paddingTop: isMobile ? 'max(env(safe-area-inset-top, 0px), 14px)' : '14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(30,30,50,0.98)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        {/* Nút back — mobile only */}
        {isMobile && (
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: GOLD, fontSize: '1.5rem', lineHeight: 1, padding: '2px 8px 2px 0',
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}
          >‹</button>
        )}
        <span style={{ fontSize: '1.1rem' }}>💬</span>
        <div>
          <div style={{ fontWeight: 700, color: GOLD, fontSize: '0.95rem', letterSpacing: '0.04em' }}>CHAT NỘI BỘ</div>
          <div style={{ fontSize: '0.72rem', color: '#7878a0', marginTop: '1px' }}>Tất cả thành viên</div>
        </div>
      </div>

      {/* Messages — spacer div đẩy messages xuống đáy (thay thế minHeight:100% không hoạt động trên Safari) */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />{/* spacer */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555570', fontSize: '0.82rem', padding: '20px 0' }}>
              Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
            </div>
          )}

          {grouped.map((msg) => {
            const me = isMe(msg);
            const color = avatarColor(msg.user_name);
            const isHovered = hoverId === msg.id;
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: me ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginTop: msg.showName ? '10px' : '1px' }}
                onMouseEnter={() => setHoverId(msg.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                {/* Avatar */}
                {!me && (
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                    background: msg.last ? color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.62rem', fontWeight: 700, color: '#fff',
                    visibility: msg.last ? 'visible' : 'hidden',
                  }}>
                    {initials(msg.user_name)}
                  </div>
                )}

                <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start' }}>
                  {msg.showName && (
                    <div style={{ fontSize: '0.68rem', color: '#7878a0', marginBottom: '3px', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                      {!me && <span style={{ fontWeight: 600, color }}>{msg.user_name}</span>}
                      <span>{formatTime(msg.created_at)}</span>
                    </div>
                  )}

                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                      <textarea
                        ref={editRef}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => onEditKey(e, msg.id)}
                        rows={2}
                        style={{
                          padding: '8px 12px', borderRadius: '10px', resize: 'none',
                          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.4)',
                          color: '#e0e0ee', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#7878a0', cursor: 'pointer', fontSize: '0.75rem' }}>Hủy</button>
                        <button onClick={() => saveEdit(msg.id)} style={{ padding: '3px 10px', borderRadius: '6px', border: 'none', background: GOLD, color: '#1a1a2e', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Lưu</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: me ? 'row-reverse' : 'row' }}>
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: me ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: me ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.06)',
                        border: me ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        color: '#e0e0ee', fontSize: '0.85rem', lineHeight: 1.45,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                        {msg.edited_at && (
                          <span style={{ fontSize: '0.62rem', color: '#555570', marginLeft: '6px' }}>(đã sửa)</span>
                        )}
                      </div>

                      {isHovered && (
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          {isMe(msg) && (
                            <button
                              onClick={() => startEdit(msg)}
                              title="Chỉnh sửa"
                              style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#7878a0', cursor: 'pointer', fontSize: '0.7rem' }}
                            >✏️</button>
                          )}
                          {canDelete(msg) && (
                            <button
                              onClick={() => deleteMsg(msg.id)}
                              title="Xóa"
                              style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem' }}
                            >🗑</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!msg.showName && msg.last && !isEditing && (
                    <div style={{ fontSize: '0.62rem', color: '#555570', marginTop: '2px' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        paddingBottom: isMobile ? 'max(env(safe-area-inset-bottom, 0px), 10px)' : '10px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(30,30,50,0.98)', flexShrink: 0,
        display: 'flex', gap: '10px', alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Nhập tin nhắn..."
          rows={1}
          style={{
            flex: 1, resize: 'none', padding: '9px 13px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', color: '#e0e0ee', fontSize: '0.87rem',
            outline: 'none', lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto',
            fontFamily: 'inherit',
          }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{
            padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: text.trim() && !sending ? GOLD : 'rgba(201,168,76,0.2)',
            color: text.trim() && !sending ? '#1a1a2e' : '#7878a0',
            fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          Gửi
        </button>
      </div>
    </div>
  );

  // Mobile: render ngoài Layout (portal) để tránh overflow:hidden clip
  // Desktop: render bình thường trong Layout
  return isMobile ? createPortal(content, document.body) : content;
}
