#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
VERSION_FILE="$SCRIPT_DIR/version.json"

# Use python to update the json file safely
python3 -c "
import json
import datetime
import sys

try:
    with open('$VERSION_FILE', 'r') as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {'build': 0}

data['build'] = data.get('build', 0) + 1
data['date'] = datetime.datetime.now().isoformat()

with open('$VERSION_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"

# Stage the file so it is included in the commit
git add "$VERSION_FILE"
