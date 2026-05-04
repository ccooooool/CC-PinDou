import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { Loader2, Wifi, WifiOff, ArrowRight, Wand2 } from 'lucide-react';

export default function EntryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/models', { signal: controller.signal })
      .then((res) => {
        if (res.ok) {
          setStatus('online');
        } else {
          setStatus('offline');
        }
      })
      .catch(() => {
        setStatus('offline');
      });

    return () => controller.abort();
  }, []);

  // 倒计时自动跳转
  useEffect(() => {
    if (status === 'checking') return;
    if (countdown <= 0) {
      navigate(status === 'online' ? '/full' : '/simple', { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(timer);
  }, [status, countdown, navigate]);

  return (
    <div className="dop-flex-center" style={{ height: '100vh', background: 'var(--bg-base)', padding: 20 }}>
      <div className="dop-card" style={{ padding: '40px 48px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div
          className="dop-anim-float"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--nook-wood)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#fff',
          }}
        >
          <Wand2 style={{ width: 32, height: 32 }} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
          拼豆图案生成器
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px', fontWeight: 600 }}>
          选择工作模式，开始创作
        </p>

        {/* 检测状态 */}
        {status === 'checking' && (
          <div className="dop-flex-center" style={{ flexDirection: 'column', gap: 12, padding: '20px 0' }}>
            <Loader2
              className="animate-spin"
              style={{ width: 28, height: 28, color: 'var(--dop-pink)' }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>
              正在检测后端服务...
            </span>
          </div>
        )}

        {status === 'online' && (
          <div className="dop-alert dop-alert-success" style={{ marginBottom: 24 }}>
            <Wifi style={{ width: 18, height: 18 }} />
            <span>后端已连接，{countdown}秒后进入完整模式</span>
          </div>
        )}

        {status === 'offline' && (
          <div className="dop-alert dop-alert-warning" style={{ marginBottom: 24 }}>
            <WifiOff style={{ width: 18, height: 18 }} />
            <span>未检测到后端服务，{countdown}秒后进入离线模式</span>
          </div>
        )}

        {/* 手动选择 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button variant="primary" block size="lg" onClick={() => navigate('/full')}>
            <Wifi style={{ width: 16, height: 16 }} />
            进入完整模式（需后端）
            <ArrowRight style={{ width: 14, height: 14 }} />
          </Button>
          <Button variant="secondary" block size="lg" onClick={() => navigate('/simple')}>
            <WifiOff style={{ width: 16, height: 16 }} />
            进入离线模式（纯前端）
          </Button>
        </div>
      </div>
    </div>
  );
}
