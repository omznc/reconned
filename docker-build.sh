#!/bin/bash

set -e

if [ ! -f .env ]; then
	echo "Error: .env file not found"
	exit 1
fi

BUILD_ARGS=()

while IFS= read -r line || [ -n "$line" ]; do
	line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
	
	if [[ -z "$line" || "$line" =~ ^# ]]; then
		continue
	fi
	
	if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
		key="${BASH_REMATCH[1]}"
		value="${BASH_REMATCH[2]}"
		
		key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
		value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed "s/^['\"]//;s/['\"]$//")
		
		if [[ -n "$key" && -n "$value" && "$key" =~ ^NEXT_PUBLIC_ ]]; then
			BUILD_ARGS+=("--build-arg" "$key=$value")
		fi
	fi
done < .env

BUILD_ARGS+=("--build-arg" "CI=true")

docker build "${BUILD_ARGS[@]}" "$@"

