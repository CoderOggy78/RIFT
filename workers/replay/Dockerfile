# RIFT Replay Worker Container
# Secure, unprivileged, network-isolated sandbox for executing typed replay operations.

FROM python:3.12-alpine

# Security: Create unprivileged user with explicit UID/GID
RUN addgroup -g 10001 replaygroup && \
    adduser -u 10001 -G replaygroup -h /home/replayuser -D replayuser

# Create workspace and worker directory
WORKDIR /app
RUN mkdir -p /workspace /app/output && \
    chown -R replayuser:replaygroup /app /workspace /app/output

# Copy worker implementation
COPY --chown=replayuser:replaygroup . /app/

# Switch to unprivileged user
USER 10001:10001

# Disable bytecode write and buffering
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ENTRYPOINT ["python", "/app/worker.py"]
