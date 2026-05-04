/**
 * 统一 API Client
 * 封装所有后端接口调用，提供类型安全和统一的错误处理。
 */

import type { GridCell, ColorInfo } from '../types/perler';

export interface ApiError extends Error {
  status: number;
  responseText?: string;
}

class ApiErrorImpl extends Error implements ApiError {
  status: number;
  responseText?: string;

  constructor(message: string, status: number, responseText?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.responseText = responseText;
  }
}

function throwIfError(res: Response): void {
  if (!res.ok) {
    throw new ApiErrorImpl(
      `请求失败: ${res.status} ${res.statusText}`,
      res.status
    );
  }
}

// =============================================================================
// 类型定义
// =============================================================================

export interface DetectPixelResponse {
  success: boolean;
  pixel_size: number;
  offset_x: number;
  offset_y: number;
}

export interface ModelInfo {
  name: string;
  label: string;
  desc: string;
  size_mb: string;
  tags: string[];
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string;
}

export interface ExportRequest {
  grid_data: GridCell[][];
  color_list: ColorInfo[];
  brand?: string;
  show_code?: boolean;
  show_legend?: boolean;
  circle_mode?: boolean;
  show_mark_lines?: boolean;
  mark_interval?: number;
  format?: 'png' | 'jpg';
}

// =============================================================================
// API 方法
// =============================================================================

/**
 * AI 移除背景
 */
export async function removeBg(
  file: File,
  options: {
    edgeThreshold?: number;
    model?: string;
    taskId?: string;
  } = {}
): Promise<Blob> {
  const { edgeThreshold = 30, model, taskId } = options;
  const formData = new FormData();
  formData.append('image', file);
  formData.append('edge_threshold', String(edgeThreshold));
  if (model) formData.append('model', model);
  if (taskId) formData.append('task_id', taskId);

  const res = await fetch('/api/remove-bg', { method: 'POST', body: formData });
  throwIfError(res);
  return res.blob();
}

/**
 * 线条增强
 */
export async function enhanceLines(file: File, strength: number): Promise<Blob> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('strength', String(strength));

  const res = await fetch('/api/enhance-lines', { method: 'POST', body: formData });
  throwIfError(res);
  return res.blob();
}

/**
 * 像素图自动检测
 */
export async function detectPixel(file: File): Promise<DetectPixelResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/detect-pixel', { method: 'POST', body: formData });
  throwIfError(res);
  return res.json();
}

/**
 * 获取可用的 rembg 模型列表
 */
export async function getModels(): Promise<ModelsResponse> {
  const res = await fetch('/api/models');
  throwIfError(res);
  return res.json();
}

/**
 * 高清图纸导出
 */
export async function exportImage(request: ExportRequest): Promise<Blob> {
  const res = await fetch('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  throwIfError(res);
  return res.blob();
}

/**
 * 建立 SSE 进度连接
 */
export function createProgressStream(taskId: string): EventSource {
  return new EventSource(`/api/progress/${taskId}`);
}
