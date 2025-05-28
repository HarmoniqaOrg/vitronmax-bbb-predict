/**
 * API client for VitronMax backend
 */

import axios from 'axios';
import type { 
  MoleculeResult, 
  BatchJob, 
  BatchUploadFormData,
  SinglePredictionFormData,
  ModelInfo,
  ExplainRequest,
  PdbOutput // Added PdbOutput type
} from './types';

// Helper function to determine the API base URL
const getApiBaseUrl = (): string => {
  const apiUrlFromEnv = import.meta.env.VITE_API_URL;

  // Check if we are in a production environment (Vite sets import.meta.env.PROD)
  if (import.meta.env.PROD) {
    if (!apiUrlFromEnv) {
      console.error(
        "CRITICAL: VITE_API_URL is not set in the production environment! " +
        "Please ensure this environment variable is correctly configured."
      );
      // Fallback to a non-functional or clearly problematic URL to make the error obvious
      // Or, if you have a fixed production URL you can use as a last resort (though env var is better)
      return "https://error.vite_api_url_not_set.com"; // Or your actual prod URL as a last resort
    }
    return apiUrlFromEnv; // Use the environment variable in production
  }

  // For development (import.meta.env.DEV is true or PROD is false)
  // Use the environment variable if set, otherwise fallback to localhost
  return apiUrlFromEnv || 'http://localhost:8001/api/v1';
};

// Create axios instance with base config
const api = axios.create({
  baseURL: getApiBaseUrl(), // Use the helper function
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the error or send it to a logging service
    // You can customize this based on your error handling strategy
    console.error('API Error:', error.response?.data || error.message);
    // Optionally, re-throw a more user-friendly error or a custom error object
    // For now, just re-throwing the original error
    return Promise.reject(error);
  }
);

// API client functions
export const apiClient = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/healthz');
    return response.data;
  },

  // Single molecule prediction
  predictMolecule: async (data: SinglePredictionFormData): Promise<MoleculeResult> => {
    const response = await api.post('/predict', data);
    return response.data;
  },

  // Batch prediction - updated to match your FastAPI backend
  uploadBatchFile: async (formData: BatchUploadFormData): Promise<BatchJob> => {
    const form = new FormData();
    form.append('file', formData.file);
    
    if (formData.jobName) {
      form.append('job_name', formData.jobName);
    }
    
    if (formData.notifyEmail) {
      form.append('notify_email', formData.notifyEmail);
    }
    
    const response = await api.post('/batch_jobs/batch_predict_csv', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  // Get batch job status
  getBatchStatus: async (jobId: string): Promise<BatchJob> => {
    const response = await api.get(`/batch_jobs/batch_status/${jobId}`);
    return response.data;
  },

  // Get all batch jobs
  getAllBatchJobs: async (): Promise<BatchJob[]> => {
    const response = await api.get('/batch_jobs');
    return response.data;
  },

  // Download batch results
  getBatchDownloadUrl: (jobId: string): string => {
    // Ensure baseURL doesn't end with a slash if paths don't start with one
    const cleanedBaseURL = api.defaults.baseURL?.replace(/\/$/, '');
    return `${cleanedBaseURL}/batch_jobs/download_batch_results/${jobId}`;
  },

  // Generate PDF report
  getReportUrl: (moleculeId: string): string => {
    const cleanedBaseURL = api.defaults.baseURL?.replace(/\/$/, '');
    return `${cleanedBaseURL}/report/${moleculeId}`;
  },

  generateReportFromSmiles: async (data: SinglePredictionFormData): Promise<Blob> => {
    const response = await api.post('/report', data, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Get model info
  getModelInfo: async (): Promise<ModelInfo> => {
    const response = await api.get('/model/info');
    return response.data;
  },

  // Get explanation for a prediction
  explainPrediction: async (data: ExplainRequest): Promise<Response> => {
    // Using fetch for EventSource compatibility
    const cleanedBaseURL = api.defaults.baseURL?.replace(/\/$/, '');
    return fetch(`${cleanedBaseURL}/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  // Get sample explanation (for demo purposes)
  getSampleExplanation: async () => {
    const response = await api.get('/explain/sample');
    return response.data;
  },

  // Convert SMILES to PDB
  convertSmilesToPdb: async (smiles: string): Promise<PdbOutput> => {
    const response = await api.post<PdbOutput>('/utils/smiles-to-pdb', { smiles });
    return response.data;
  },
};

// Function to get a presigned URL for downloading batch results
export const getBatchResultsPresignedUrl = async (jobId: string): Promise<string> => {
  const response = await api.get(`/batch_jobs/download_batch_results_presigned_url/${jobId}`);
  return response.data.download_url;
};

// New function to fetch platform statistics
export interface PlatformStatistics {
  total_predictions: number;
  total_batch_jobs: number;
  avg_batch_processing_time_seconds: number;
  overall_batch_success_rate_percentage: number;
}

export const getPlatformStatistics = async (): Promise<PlatformStatistics> => {
  const response = await api.get<PlatformStatistics>('/platform-statistics');
  return response.data;
};

export default apiClient;