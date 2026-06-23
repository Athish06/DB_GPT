/// <reference types="vite/client" />
const API_BASE_URL = import.meta.env.VITE_API_URL;

class ApiClient {
  async request(endpoint: string, options: RequestInit = {}) {
    console.log(endpoint)
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('jwt_user');
        window.location.reload();
        throw new Error('Session expired. Please log in again.');
      }
      
      // Specifically check for our 403 API Key error
      const errorMessage = data.error || data.message || (typeof data === 'string' ? data : 'Request failed');
      throw new Error(`An error occurred: ${errorMessage}. Please check your inputs and try again.`);
    }

    return data;
  }

  get(endpoint: string) {
    return this.request(endpoint);
  }

  post(endpoint: string, body: Record<string, unknown>) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();