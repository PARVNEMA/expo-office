import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { supabase } from '@/lib/supabase';
import { API_CONFIG } from '@/config/constants';
import { ApiResponse, ApiError } from '@/types/api.types';

class ApiService {
  private client: AxiosInstance;
  private isRefreshing: boolean = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return this.client(originalRequest);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;
          // refresh logic
          try {
            // Refresh Supabase session
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !data.session?.access_token) {
              throw new Error('Session refresh failed');
            }

            const newToken = data.session.access_token;
            this.processQueue(null, newToken);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            // Sign out user if refresh fails
            await supabase.auth.signOut();
            throw this.handleError(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private processQueue(error: any, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }


  private handleError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = {
        message:
          error.response?.data?.message ||
          error.message ||
          'An unexpected error occurred',
        status: error.response?.status || 0,
        code: error.response?.data?.code || error.code,
        details: error.response?.data?.details || null,
      };
      return apiError;
    }

    return {
      message: 'An unexpected error occurred',
      status: 0,
    };
  }

  private async retryRequest<T>(
    request: () => Promise<AxiosResponse<T>>,
    attempts: number = API_CONFIG.RETRY_ATTEMPTS
  ): Promise<AxiosResponse<T>> {
    try {
      return await request();
    } catch (error) {
      if (attempts > 1 && this.shouldRetry(error)) {
        await this.delay(API_CONFIG.RETRY_DELAY);
        return this.retryRequest(request, attempts - 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    if (!axios.isAxiosError(error)) return false;

    const status = error.response?.status;
    return !status || status >= 500 || status === 429;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Public methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.retryRequest(() =>
      this.client.get<ApiResponse<T> | T>(url, config)
    );
    return (response.data as ApiResponse<T>).data || (response.data as T);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.retryRequest(() =>
      this.client.post<ApiResponse<T> | T>(url, data, config)
    );
    return (response.data as ApiResponse<T>).data || (response.data as T);
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.retryRequest(() =>
      this.client.put<ApiResponse<T> | T>(url, data, config)
    );
    return (response.data as ApiResponse<T>).data || (response.data as T);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.retryRequest(() =>
      this.client.patch<ApiResponse<T> | T>(url, data, config)
    );
    return (response.data as ApiResponse<T>).data || (response.data as T);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.retryRequest(() =>
      this.client.delete<ApiResponse<T> | T>(url, config)
    );
    return (response.data as ApiResponse<T>).data || (response.data as T);
  }
}

export const apiService = new ApiService();
