import { Outlet } from 'react-router-dom';

/**
 * 纯前端阉割版（离线模式）
 * 不发起任何后端 API 请求，所有功能使用前端降级实现
 */
export default function SimplePage() {
  return <Outlet />;
}
