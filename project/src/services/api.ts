import toast from 'react-hot-toast';
import { DatabaseCredentials, TableInfo, TableData } from '../contexts/DatabaseContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async connectDatabase(credentials: DatabaseCredentials): Promise<{ success: boolean; message: string }> {
    return this.request('/database/connect', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getTables(): Promise<TableInfo[]> {
    return this.request('/database/tables');
  }

  async getTableData(tableName: string): Promise<TableData> {
    return this.request(`/database/tables/${tableName}/data`);
  }

  async queryWithAI(question: string, tableName?: string): Promise<{ 
    query: string; 
    result: any[]; 
    explanation: string 
  }> {
    return this.request('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ question, tableName }),
    });
  }

  async generateFormValues(prompt: string, schema: Array<{ name: string; type: string }>): Promise<Record<string, any>> {
    return this.request('/ai/generate-form', {
      method: 'POST',
      body: JSON.stringify({ prompt, schema }),
    });
  }

  async insertData(tableName: string, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    return this.request('/database/insert', {
      method: 'POST',
      body: JSON.stringify({ tableName, data }),
    });
  }
}

export const apiService = new ApiService();

// Helper function to handle API calls with loading and error states
export const withApiCall = async <T>(
  apiCall: () => Promise<T>,
  loadingMessage?: string,
  successMessage?: string
): Promise<T | null> => {
  const loadingToast = loadingMessage ? toast.loading(loadingMessage) : null;
  
  try {
    const result = await apiCall();
    
    if (loadingToast) {
      toast.dismiss(loadingToast);
    }
    
    if (successMessage) {
      toast.success(successMessage);
    }
    
    return result;
  } catch (error) {
    if (loadingToast) {
      toast.dismiss(loadingToast);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    toast.error(errorMessage);
    
    return null;
  }
};