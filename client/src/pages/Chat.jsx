import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const GOLD   = '#c9a84c';
const POLL_MS = 4000;

function formatTime(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T'));
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return hm;
  return `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
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
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const bottomRef  = useRef(null);
  const sinceRef   = useRef(null);
  const inputRef   = useRef(null);
  const pollRef    = useRef(null);

  const scrollBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Initial load
  useEffect(() => {
    api.getChatMessages().then(msgs => {
      setMessages(msgs);
      if (msgs.length) sinceRef.current = msgs[msgs.length - 1].created_at;
      setTimeout(() => scrollBottom(false), 50);
    }).catch(() => {});
  }, []);

  // Polling
  useEffect(() => {
    pollRef.current = setInterval(() => {
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
    return () => clearInterval(pollRef.current);
  }, []);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await api.sendChatMessage(content);
      sinceRef.current = msg.created_at;
      setMessages(prev => [...prev, msg]);
      setTimeout(() => scrollBottom(true), 50);
    } catch (_) {
      setText(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Group consecutive messages from same user (within 2 min)
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameUser = prev?.user_id === msg.user_id;
    const close = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 120000;
    acc.push({ ...msg, showName: !sameUser || !close, last: true });
    if (acc.length > 1) acc[acc.length - 2].last = !sameUser || !close;
    return acc;
  }, []);

  const isMe = (msg) => msg.user_id === user?.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '1.1rem' }}>💬</span>
        <div>
          <div style={{ fontWeight: 700, color: GOLD, fontSize: '0.95rem', letterSpacing: '0.04em' }}>
            CHAT NỘI BỘ
          </div>
          <div style={{ fontSize: '0.72rem', color: '#7878a0', marginTop: '1px' }}>
            Tất cả thành viên
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {grouped.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#555570', fontSize: '0.82rem' }}>
            Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
          </div>
        )}
        {grouped.map((msg) => {
          const me = isMe(msg);
          const color = avatarColor(msg.user_name);
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: me ? 'row-reverse' : 'row',
              alignItems: 'flex-end', gap: '8px',
              marginTop: msg.showName ? '10px' : '1px',
            }}>
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
                {/* Name + time */}
                {msg.showName && (
                  <div style={{ fontSize: '0.68rem', color: '#7878a0', marginBottom: '3px', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                    {!me && <span style={{ fontWeight: 600, color: color }}>{msg.user_name}</span>}
                    <span>{formatTime(msg.created_at)}</span>
                  </div>
                )}
                {/* Bubble */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: me ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: me
                    ? 'rgba(201,168,76,0.18)'
                    : 'rgba(255,255,255,0.06)',
                  border: me
                    ? '1px solid rgba(201,168,76,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: '#e0e0ee',
                  fontSize: '0.85rem',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {/* Time for non-grouped */}
                {!msg.showName && msg.last && (
                  <div style={{ fontSize: '0.62rem', color: '#555570', marginTop: '2px' }}>
                    {formatTime(msg.created_at)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        display: 'flex', gap: '10px', alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Nhập tin nhắn... (Enter gửi, Shift+Enter xuống dòng)"
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
}
