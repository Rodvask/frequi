import type { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Wraps API calls with standard try/catch + error logging.
 * Eliminates the repetitive try/catch/return Promise pattern in stores.
 *
 * @example
 * // Before:
 * async getState() {
 *   try {
 *     const { data } = await api.get('/show_config');
 *     this.botState = data;
 *     return Promise.resolve(data);
 *   } catch (error) {
 *     console.error(error);
 *     return Promise.reject(error);
 *   }
 * }
 *
 * // After:
 * async getState() {
 *   const data = await apiCall(api.get('/show_config'), (res) => { this.botState = res.data; });
 * }
 */

export async function apiCall<T>(
  request: Promise<AxiosResponse<T>>,
  onSuccess?: (response: AxiosResponse<T>) => void,
): Promise<T> {
  try {
    const response = await request;
    onSuccess?.(response);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Wraps an API GET request with standard error handling.
 */
export function apiGet<T>(
  api: AxiosInstance,
  url: string,
  onSuccess?: (data: T) => void,
): Promise<T> {
  return apiCall<T>(api.get<T>(url), (res) => onSuccess?.(res.data));
}

/**
 * Wraps an API POST request with standard error handling.
 */
export function apiPost<T, P>(
  api: AxiosInstance,
  url: string,
  payload: P,
  onSuccess?: (data: T) => void,
): Promise<T> {
  return apiCall<T>(api.post<T>(url, payload), (res) => onSuccess?.(res.data));
}

/**
 * Wraps an API DELETE request with standard error handling.
 */
export function apiDelete<T>(
  api: AxiosInstance,
  url: string,
  config?: Record<string, unknown>,
  onSuccess?: (data: T) => void,
): Promise<T> {
  return apiCall<T>(api.delete<T>(url, config), (res) => onSuccess?.(res.data));
}
