import re

file_path = "/Users/tim/Code/fhfhockey.com/web/pages/game/[gameId].tsx"

with open(file_path, 'r') as f:
    content = f.read()

# Find className={`...`}
matches = re.findall(r'className=\{`([^`]*)`\}', content)

for m in matches:
    print(f"Found template: {m}")
