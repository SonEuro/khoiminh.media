import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(form);
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, #0a0a10 60%)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
    }}>
      <div style={{ width:'100%', maxWidth:'360px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src="/logo.png" alt="Khôi Minh" style={{ height:'60px', margin:'0 auto' }} />
          <div style={{ marginTop:'1rem', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ flex:1, height:'1px', background:'linear-gradient(90deg,transparent,rgba(201,168,76,0.5))' }} />
            <span style={{ color:'rgba(201,168,76,0.7)', fontSize:'0.6rem', letterSpacing:'0.2em', fontWeight:700 }}>
              QUẢN LÝ KHO THIẾT BỊ
            </span>
            <div style={{ flex:1, height:'1px', background:'linear-gradient(270deg,transparent,rgba(201,168,76,0.5))' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:'#13131d',
          border:'1px solid rgba(201,168,76,0.35)',
          borderRadius:'1rem',
          padding:'2rem',
          boxShadow:'0 0 60px rgba(201,168,76,0.08), 0 20px 60px rgba(0,0,0,0.6)',
        }}>
          {/* Corner accents */}
          <div style={{ position:'relative', marginBottom:'1.5rem' }}>
            <h2 style={{ color:'#eeeef5', fontSize:'1.25rem', fontWeight:700, marginBottom:'0.25rem' }}>
              Đăng nhập
            </h2>
            <p style={{ color:'#7878a0', fontSize:'0.8rem' }}>Vui lòng đăng nhập để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#c9a84c', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.4rem' }}>
                Tên đăng nhập
              </label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="username"
                required
                style={{
                  width:'100%', padding:'0.6rem 0.875rem',
                  background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(201,168,76,0.3)',
                  borderRadius:'0.5rem',
                  color:'#eeeef5', fontSize:'0.9rem',
                  outline:'none', boxSizing:'border-box',
                  transition:'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor='#c9a84c'; e.target.style.boxShadow='0 0 0 3px rgba(201,168,76,0.15)'; }}
                onBlur={e => { e.target.style.borderColor='rgba(201,168,76,0.3)'; e.target.style.boxShadow='none'; }}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#c9a84c', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.4rem' }}>
                Mật khẩu
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                style={{
                  width:'100%', padding:'0.6rem 0.875rem',
                  background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(201,168,76,0.3)',
                  borderRadius:'0.5rem',
                  color:'#eeeef5', fontSize:'0.9rem',
                  outline:'none', boxSizing:'border-box',
                  transition:'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor='#c9a84c'; e.target.style.boxShadow='0 0 0 3px rgba(201,168,76,0.15)'; }}
                onBlur={e => { e.target.style.borderColor='rgba(201,168,76,0.3)'; e.target.style.boxShadow='none'; }}
              />
            </div>

            {error && (
              <div style={{
                background:'rgba(220,50,50,0.12)',
                border:'1px solid rgba(220,50,50,0.4)',
                borderRadius:'0.5rem',
                padding:'0.6rem 0.875rem',
                color:'#f87171', fontSize:'0.82rem',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width:'100%',
                padding:'0.7rem',
                marginTop:'0.25rem',
                background: loading
                  ? 'rgba(201,168,76,0.3)'
                  : 'linear-gradient(135deg, #b8922e 0%, #e8c97a 50%, #b8922e 100%)',
                border:'1px solid rgba(201,168,76,0.6)',
                borderRadius:'0.5rem',
                color:'#08080e',
                fontWeight:800,
                fontSize:'0.9rem',
                letterSpacing:'0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 0 20px rgba(201,168,76,0.35)',
                transition:'all 0.2s',
              }}
            >
              {loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
