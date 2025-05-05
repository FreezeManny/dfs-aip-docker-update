FROM python:3.9-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy application code
COPY basic/ /app/

# Install requirements
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory
RUN mkdir -p /app/.cache/dfs-aip

# Create output directory
RUN mkdir -p /app/output

# Default command to keep container running
CMD ["bash"]