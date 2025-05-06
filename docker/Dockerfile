FROM debian:bullseye-slim

# Install Python, cron, and jq
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    cron \
    jq \
    ocrmypdf \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy application code
COPY basic/ /app/basic-aip

# Copy scripts
#COPY docker/scripts/update_aip.sh /app/update_aip.sh
COPY docker/scripts/entrypoint.sh /entrypoint.sh

# Make scripts executable
#RUN chmod +x /app/update_aip.sh /entrypoint.sh

# Install requirements
RUN pip3 install --no-cache-dir -r ./basic-aip/requirements.txt

# Create cache directory
RUN mkdir -p /app/.cache/dfs-aip

# Create output directory
#RUN mkdir -p /app/docker/output

# Setup cron job
#RUN echo "${CRON_SCHEDULE:-0 0 * * *} /app/update_aip.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/aip-update && \
#    chmod 0644 /etc/cron.d/aip-update && \
#    crontab /etc/cron.d/aip-update

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]