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
    pngquant \
    jbig2dec \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy application code
COPY basic/ /app/basic-aip
COPY docker/scripts/requirements.txt /app/requirements.txt

# Copy scripts
COPY docker/scripts/update_aip.py /app/update_aip.py
COPY docker/scripts/entrypoint.sh /entrypoint.sh

# Make scripts executable
RUN chmod +x /entrypoint.sh
RUN chmod +x /app/update_aip.py

# Install requirements
RUN pip3 install --no-cache-dir -r ./basic-aip/requirements.txt && \
    pip3 install --no-cache-dir -r ./requirements.txt

# Setup cron job
RUN echo "${CRON_SCHEDULE:-0 0 * * *} python3 -u /app/update_aip.py >> /var/log/cron.log 2>&1" > /etc/cron.d/aip-update && \
    chmod 0644 /etc/cron.d/aip-update && \
    crontab /etc/cron.d/aip-update

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]