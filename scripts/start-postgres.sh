#!/bin/bash
CONTAINER_NAME="reconned-postgres-dev"
if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
  echo "Starting $CONTAINER_NAME..."
  docker start "$CONTAINER_NAME" 2>/dev/null || docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=reconned -p 5432:5432 postgres:16-alpine
fi
