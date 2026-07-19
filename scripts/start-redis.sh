#!/bin/bash
CONTAINER_NAME="reconned-redis-dev"
if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
  echo "Starting $CONTAINER_NAME..."
  docker start "$CONTAINER_NAME" 2>/dev/null || docker run -d --name "$CONTAINER_NAME" -p 6379:6379 redis:7-alpine
fi
