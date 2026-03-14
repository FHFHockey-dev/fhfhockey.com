import re

file_path = "/Users/tim/Code/fhfhockey.com/web/pages/game/[gameId].tsx"

with open(file_path, 'r') as f:
    content = f.read()

# 1. Fix teamCard
# From: className={`teamCard teamCard--${side}`}
# To: className={`${styles.teamCard} ${side === 'away' ? styles['teamCard--away'] : ''}`}
# Note: assuming 'home' has no specific class or we handle it. If side is purely home/away.
# The original code used teamCard--${side} which implies teamCard--home might have been used but done nothing if global css didn't have it.
# CSS Modules returns undefined for missing keys.
content = content.replace(
    'className={`teamCard teamCard--${side}`}', 
    "className={`${styles['teamCard']} ${side === 'away' ? styles['teamCard--away'] : ''}`}"
)

# 2. Fix statusPill
# From: className={`statusPill ${isLive ? "is-live" : isFinal ? "is-final" : "is-scheduled"}`}
# To: className={`${styles.statusPill} ${isLive ? styles['is-live'] : isFinal ? styles['is-final'] : styles['is-scheduled']}`}
# Regex for flexibility
content = re.sub(
    r'className=\{`statusPill\s+(\$\{.*\})`\}', 
    lambda m: f"className={{`${{styles.statusPill}} {m.group(1)}`}}", # This wraps the existing logic? No, the logic returns strings "is-live".
    content
)
# The logic inside ${...} returns string literals "is-live". We need those literals to be style lookups.
# Easier to replace the internal strings.
regex_status = r'(isLive\s*\?\s*)"is-live"(\s*:\s*isFinal\s*\?\s*)"is-final"(\s*:\s*)"is-scheduled"'
def status_replacer(m):
    return f'{m.group(1)}styles["is-live"]{m.group(2)}styles["is-final"]{m.group(3)}styles["is-scheduled"]'

# We also need to fix the outer part: `statusPill ...` -> `${styles.statusPill} ...`
# Let's do it in two passes or carefully.
# Replace the strings inside the specific block first.
content = content.replace('"is-live"', 'styles["is-live"]')
content = content.replace('"is-final"', 'styles["is-final"]')
content = content.replace('"is-scheduled"', 'styles["is-scheduled"] || "is-scheduled"') # Fallback if missing
# Now replace the outer `statusPill`
content = content.replace('className={`statusPill ', 'className={`${styles.statusPill} ')

# 3. Fix gameHero__score
# From: className={`gameHero__score ${showScores ? "gameHero__score--final" : ""}`}
# To: ...
content = content.replace(
    'className={`gameHero__score ${showScores ? "gameHero__score--final" : ""}`}',
    "className={`${styles['gameHero__score']} ${showScores ? styles['gameHero__score--final'] : ''}`}"
)

# 4. Fix statRow
# From: className={`statRow ${advantageClass}`}
# To: className={`${styles.statRow} ${styles[advantageClass]}`}
content = content.replace(
    'className={`statRow ${advantageClass}`}',
    "className={`${styles.statRow} ${styles[advantageClass]}`}"
)

# 5. Fix advantageClass definition (logic before return)
# const advantageClass = advantageTeam !== "tie" ? `is-${advantageTeam}` : "is-tie";
# This string "is-home" is correctly generated.
# But we need styles['is-home'].
# In the loop above (4), we use styles[advantageClass]. 
# So if advantageClass is "is-home", styles["is-home"] works.
# Perfect.

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed templates.")
