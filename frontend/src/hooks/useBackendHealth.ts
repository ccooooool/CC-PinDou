import { useState, useEffect, useRef } from 'react';

export interface BackendHealth {
  available: boolean;
  checking: boolean;
  retry: () => void;
}

/**
 * 后端健康检查 Hook
 * 启动时检测后端是否可用，维护 available 状态。
 * 需要后端的功能应根据此状态决定是否禁用。
 */
export function useBackendHealth(enabled: boolean = true): BackendHealth {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const check = async () => {
    setChecking(true);
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/models', {
        signal: abortRef.current.signal,
        method: 'GET',
      });
      setAvailable(res.ok);
    } catch {
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      setAvailable(false);
      return;
    }
    check();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [enabled]);

  return { available, checking, retry: check };
}
