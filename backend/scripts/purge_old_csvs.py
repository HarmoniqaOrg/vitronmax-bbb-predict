
#!/usr/bin/env python3
"""
Utility script to purge old CSV results from storage.

CSV files older than a configured retention period will be
deleted from the storage bucket to free up space.
"""

import os
import argparse
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("purge-script")

# Default settings
DEFAULT_RETENTION_DAYS = 30
DEFAULT_BATCH_SIZE = 100


def connect_to_supabase():
    """Connect to Supabase client."""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        return None
    
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return None


def get_files_to_purge(supabase, bucket_name, retention_days):
    """Get list of files older than retention period."""
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    cutoff_str = cutoff_date.isoformat()
    
    try:
        # Get completed jobs older than cutoff date
        response = supabase.table("batch_jobs") \
            .select("job_id,results_file_path") \
            .lt("created_at", cutoff_str) \
            .eq("status", "completed") \
            .execute()
        
        if not response.data:
            logger.info("No old batch jobs found to purge")
            return []
        
        # Extract file paths
        file_paths = [job["results_file_path"] for job in response.data if job.get("results_file_path")]
        logger.info(f"Found {len(file_paths)} files older than {retention_days} days")
        return file_paths
        
    except Exception as e:
        logger.error(f"Failed to retrieve list of files: {e}")
        return []


def purge_files(supabase, bucket_name, file_paths, batch_size):
    """Delete files in batches."""
    success_count = 0
    error_count = 0
    
    for i in range(0, len(file_paths), batch_size):
        batch = file_paths[i:i + batch_size]
        
        for file_path in batch:
            try:
                # Delete file from storage
                supabase.storage.from_(bucket_name).remove([file_path])
                logger.debug(f"Deleted file: {file_path}")
                success_count += 1
                
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
                error_count += 1
    
    logger.info(f"Purge completed. Deleted {success_count} files. Failed to delete {error_count} files.")
    return success_count, error_count


def main():
    """Main script function."""
    parser = argparse.ArgumentParser(description="Purge old CSV files from storage")
    parser.add_argument("--retention-days", type=int, default=DEFAULT_RETENTION_DAYS,
                        help=f"Retention period in days (default: {DEFAULT_RETENTION_DAYS})")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Number of files to delete in a batch (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--dry-run", action="store_true",
                        help="List files that would be deleted without actually deleting them")
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.retention_days < 1:
        parser.error("Retention days must be at least 1")
    
    bucket_name = os.environ.get("STORAGE_BUCKET_NAME", "vitronmax-storage")
    
    # Connect to Supabase
    supabase = connect_to_supabase()
    if not supabase:
        return 1
    
    # Get files to purge
    file_paths = get_files_to_purge(supabase, bucket_name, args.retention_days)
    
    if not file_paths:
        logger.info("No files to purge")
        return 0
    
    # In dry run mode, just list the files
    if args.dry_run:
        logger.info("Dry run - would delete these files:")
        for file_path in file_paths:
            logger.info(f"  {file_path}")
        return 0
    
    # Purge files
    purge_files(supabase, bucket_name, file_paths, args.batch_size)
    return 0


if __name__ == "__main__":
    exit(main())
