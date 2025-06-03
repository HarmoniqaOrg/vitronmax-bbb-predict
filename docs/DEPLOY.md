# VitronMax Deployment Guide

This guide details the steps required to deploy the VitronMax platform using Fly.io and Supabase.

## Prerequisites

- [Fly.io](https://fly.io) account with billing set up
- [Supabase](https://supabase.com) account
- [GitHub](https://github.com) account for CI/CD
- OpenAI API key
- `flyctl` CLI installed locally
- Git

## 1. Supabase Setup

### Create a Supabase Project

1. Log in to your Supabase account
2. Create a new project with a name like `vitronmax`
3. Note your project URL and API keys from the project settings

### Database Setup

1. Execute the migrations in `backend/migrations/01_initial_schema.sql` using the Supabase SQL editor
2. Verify that all tables have been created correctly

### Storage Setup

1. Create a new storage bucket named `vitronmax-storage`. **Ensure this bucket is created and accessible.**
2. Configure bucket permissions:
   - Allow `select` for authenticated users
   - Allow `insert` for authenticated users (service role)
   - Allow `update` for service role only
   - Allow `delete` for service role only
3. Configure CORS settings for the bucket to allow your frontend domain. **Correct CORS settings are crucial for file uploads from the frontend.**

## 2. Environment Variables

Create a `.env` file in the backend directory (or configure these as secrets in your deployment environment, e.g., Fly.io secrets) with the following variables. **It is recommended to use Python 3.11+ for the backend deployment environment.**

```
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
STORAGE_BUCKET_NAME=vitronmax-storage
# MODEL_PATH=models/default_model.joblib # Optional: Path to your trained model relative to the backend app directory. Defaults to models/default_model.joblib.
FLY_API_TOKEN=your_fly_token # Specific to Fly.io deployment
LOG_LEVEL=INFO
ENV=production # Ensure this is set to 'production' for deployed environments
APP_PROJECT_ROOT_ENV=/app # For containerized deployments (like Fly.io, set in fly.toml), defines the project root inside the container.
                         # Not typically needed in local .env if running Python directly without Docker.
```

## 3. Deploying the Backend

When deploying the backend, ensure that the Python environment uses the pinned versions specified in `backend/requirements.txt`. These versions have been tested for compatibility, especially with the machine learning model.

### Initial Deployment

1. Navigate to the project root directory (where `fly.toml` and `Dockerfile` are located).
2. Run `flyctl launch` to create a new app
   - Choose a unique name like `vitronmax-api`
   - Choose the nearest region to your users
   - Choose not to deploy yet
3. Add secrets from your `.env` file:
   ```
   flyctl secrets set OPENAI_API_KEY=your_openai_api_key
   flyctl secrets set SUPABASE_URL=https://your-project-id.supabase.co
   flyctl secrets set SUPABASE_SERVICE_KEY=your_supabase_service_key
   flyctl secrets set STORAGE_BUCKET_NAME=vitronmax-storage
   flyctl secrets set ENV=production
   flyctl secrets set LOG_LEVEL=INFO
   # flyctl secrets set MODEL_PATH=models/default_model.joblib # Set if using a non-default path
   # Note: APP_PROJECT_ROOT_ENV is typically set in fly.toml (e.g., APP_PROJECT_ROOT_ENV = "/app")
   # and not as a Fly.io secret. This variable is crucial for the application to correctly
   # locate project files (like training_dataset.csv) within the Docker container.
   ```
4. Deploy the application (ensure you are in the project root directory):
   ```
   flyctl deploy
   ```

### Scaling (if needed)

```
flyctl scale count 2  # Scale to 2 instances
flyctl scale memory 2048  # Increase memory to 2GB
```

### Monitoring

```
flyctl logs
flyctl status
```

## 4. Deploying the Frontend

### Initial Deployment

1. Navigate to the frontend directory
2. Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_API_URL=https://vitronmax-api.fly.dev/api/v1
   ```
3. Run `flyctl launch` to create a new app
   - Choose a unique name like `vitronmax-dashboard`
   - Choose the nearest region to your users
   - Choose not to deploy yet
4. Add secrets:
   ```
   flyctl secrets set NEXT_PUBLIC_API_URL=https://vitronmax-api.fly.dev/api/v1
   ```
5. Deploy the application:
   ```
   flyctl deploy
   ```

## 5. Setting Up DNS

### Custom Domain for API

1. Register your domain with Fly:
   ```
   flyctl certs create api.yourdomain.com
   ```
2. Add DNS records with your domain registrar:
   - Add an A record pointing to Fly's load balancer IP
   - Add a CNAME record for `api.yourdomain.com` pointing to `vitronmax-api.fly.dev`

### Custom Domain for Dashboard

1. Register your domain with Fly:
   ```
   flyctl certs create yourdomain.com
   ```
2. Add DNS records with your domain registrar:
   - Add an A record pointing to Fly's load balancer IP
   - Add a CNAME record for `www.yourdomain.com` pointing to `vitronmax-dashboard.fly.dev`

## 6. Setting Up GitHub CI/CD

1. Add the following secrets to your GitHub repository:
   - `FLY_API_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`

2. Push the workflow files in the `.github/workflows` directory to your repository.

3. Verify that the workflows run correctly on push to the main branch.

## 7. Maintenance Tasks

### Database Backups

Set up automatic backups in the Supabase dashboard:
1. Go to Project Settings > Database
2. Configure backup settings

### CSV Purging

Set up a cron job to run `scripts/purge_old_csvs.py` regularly:

```
0 0 * * * cd /path/to/vitronmax/backend && python scripts/purge_old_csvs.py
```

Or use Fly.io scheduled jobs:
```
flyctl cron add purge_csvs "0 0 * * * python /app/scripts/purge_old_csvs.py"
```

## 8. Monitoring and Alerts

### Set Up Uptime Checks

1. Configure health check monitoring using a service like UptimeRobot or Fly's built-in features
2. Set up alerts for when the service goes down

### Set Up Log Monitoring

1. Configure Fly.io logs to be shipped to your preferred logging service
2. Set up alerts for high error rates or API failures

## 9. Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check that Supabase service key has correct permissions
   - Verify that the connection string is correct

2. **OpenAI API Errors**:
   - Check API key validity
   - Verify quota limits

3. **Storage Errors**:
   - Check bucket permissions
   - Verify that the service role has correct access rights

### Support Resources

- Fly.io Documentation: https://fly.io/docs/
- Supabase Documentation: https://supabase.io/docs
- VitronMax GitHub Issues: https://github.com/vitronmax/vitronmax/issues
