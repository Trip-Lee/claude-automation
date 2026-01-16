#!/bin/bash
# Setup test project configs for component-backend tests

CONFIG_DIR="/home/coltrip/.claude-projects"
mkdir -p "$CONFIG_DIR"

# Create configs for each test
for test_id in "SN-CB-001" "SN-CB-002" "SN-CB-003" "SN-CB-004" "SN-CB-005" "SN-CB-006"; do
  project_name="sn-test-${test_id}"
  config_file="${CONFIG_DIR}/${project_name}.yaml"

  cat > "$config_file" <<EOF
name: ${project_name}
repo: local
base_branch: main
docker:
  image: node:18
  working_dir: /workspace
test_mode: true
EOF

  echo "Created: $config_file"
done

echo "✓ All test project configs created"
