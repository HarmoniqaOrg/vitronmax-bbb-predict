/**
 * Type definitions for VitronMax frontend
 */

export interface MoleculeResult {
  smiles: string;
  molecule_name?: string;
  bbb_probability: number;
  prediction_class: string;
  confidence_score: number;
  processing_time_ms: number;
  fingerprint_features?: number[];
}

export interface BatchJob {
  job_id: string;
  job_name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  total_molecules: number;
  processed_molecules: number;
  failed_molecules: number;
  progress_percentage: number;
  estimated_completion_time?: string;
  completed_at?: string;
  error_message?: string;
  results_file_path?: string;
  notify_email?: string;
}

export interface BatchUploadFormData {
  file: File;
  jobName?: string;
  notifyEmail?: string;
}

export interface SinglePredictionFormData {
  smiles: string;
  molecule_name?: string;
}

export interface ExplainRequest {
  smiles: string;
  prediction_result?: MoleculeResult;
  context?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ModelInfo {
  model_type: string;
  fingerprint_type: string;
  fingerprint_radius: number;
  fingerprint_bits: number;
  n_estimators: number;
  top_features: [number, number][];
  is_loaded: boolean;
}

export interface RecentActivity {
  id: string;
  type: 'single' | 'batch';
  title: string;
  timestamp: string;
  status?: 'completed' | 'pending' | 'processing' | 'failed';
  result?: MoleculeResult | BatchJob;
}

export interface AppStats {
  total_predictions: number;
  total_batch_jobs: number;
  avg_response_time: number;
  success_rate: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  showConfidenceColors: boolean;
  defaultView: 'single' | 'batch';
}
