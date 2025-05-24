
-- VitronMax Initial Schema

-- Batch Jobs Table
CREATE TABLE IF NOT EXISTS batch_jobs (
    job_id UUID PRIMARY KEY,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL,
    total_molecules INTEGER NOT NULL,
    processed_molecules INTEGER NOT NULL DEFAULT 0,
    failed_molecules INTEGER NOT NULL DEFAULT 0,
    progress_percentage DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    notify_email TEXT,
    results_file_path TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion_time TIMESTAMP WITH TIME ZONE
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);

-- Molecules Table
CREATE TABLE IF NOT EXISTS molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smiles TEXT NOT NULL,
    molecule_name TEXT,
    bbb_probability DOUBLE PRECISION NOT NULL,
    prediction_class TEXT NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    fingerprint_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on fingerprint hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_molecules_fingerprint_hash ON molecules(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_molecules_smiles ON molecules(smiles);

-- Batch Results Junction Table
CREATE TABLE IF NOT EXISTS batch_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID NOT NULL REFERENCES batch_jobs(job_id) ON DELETE CASCADE,
    molecule_id UUID NOT NULL REFERENCES molecules(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster batch result queries
CREATE INDEX IF NOT EXISTS idx_batch_results_job_id ON batch_results(batch_job_id);

-- Explanations Table
CREATE TABLE IF NOT EXISTS explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    molecule_id UUID NOT NULL REFERENCES molecules(id) ON DELETE CASCADE,
    explanation_text TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster explanation queries
CREATE INDEX IF NOT EXISTS idx_explanations_molecule_id ON explanations(molecule_id);

-- Usage Metrics Table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for metrics queries
CREATE INDEX IF NOT EXISTS idx_usage_metrics_endpoint ON usage_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_created_at ON usage_metrics(created_at);

-- Storage Schema
-- Note: Supabase creates storage buckets through API calls, not SQL
-- Create vitronmax-storage bucket in Supabase dashboard or API
