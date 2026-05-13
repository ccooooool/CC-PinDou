import { Outlet } from 'react-router-dom';

/**
 * 前后端结合的完整版
 * 优先使用后端 API，不可用时自动降级到前端实现
 */
export default function FullPage() {
  return <Outlet />;
}
