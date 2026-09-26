FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY neha_agent ./neha_agent
RUN pip install . livekit-plugins-noise-cancellation \
    # Download VAD / turn-detector weights at build time, not on the first call.
    && python -m neha_agent.main download-files

# Health / load endpoint for the orchestrator.
EXPOSE 8081
CMD ["python", "-m", "neha_agent.main", "start"]
