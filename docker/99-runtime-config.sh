#!/bin/sh
set -eu

escape_json_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

api_base_url="$(escape_json_string "${API_BASE_URL:-}")"

cat > /usr/share/nginx/html/config.js <<EOF
window.__RUST_CONTROL_CONFIG__ = {
  API_BASE_URL: "${api_base_url}"
};
EOF
