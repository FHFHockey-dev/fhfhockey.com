import re

file_path = "/Users/tim/Code/fhfhockey.com/web/pages/game/[gameId].tsx"

with open(file_path, 'r') as f:
    content = f.read()

# Replace direct property access with optional chaining for state objects
obs = [
    "homeTeamStats", "awayTeamStats", 
    "homeTeamPowerPlayStats", "awayTeamPowerPlayStats"
]

for ob in obs:
    # Look for "homeTeamStats." but not "homeTeamStats?."
    # We use lookbehind or just simple replacement if we verify no ?. exists.
    # Simple replacement: replace (ob + ".") with (ob + "?.")
    # But strictly verify we don't replace if it's already optional.
    pattern = re.compile(rf"{ob}\.(?![\?])")
    content = pattern.sub(f"{ob}?.", content)

with open(file_path, 'w') as f:
    f.write(content)

print("Updated property accesses to optional chaining.")
