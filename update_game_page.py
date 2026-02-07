import re
import os

file_path = "/Users/tim/Code/fhfhockey.com/web/pages/game/[gameId].tsx"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r') as f:
    content = f.read()

def replacer(match):
    full_string = match.group(0) # className="..."
    class_string = match.group(1) # inside quotes
    
    if not class_string.strip():
        return full_string

    classes = class_string.split()
    converted_classes = []
    
    for cls in classes:
        # Ignore dynamic expressions inside string if regex caught them weirdly, but regex below catches "..."
        # If cls contains anything that looks like template usage (which shouldn't happen inside ""), we skip.
        
        # Check if styles.cls is needed
        # We can safely use bracket notation for everything to be sure.
        converted_classes.append(f"styles['{cls}']")

    if len(converted_classes) == 1:
        return f"className={{{converted_classes[0]}}}"
    else:
        # Multiple classes: className={`${styles.a} ${styles.b}`}
        joined = "} ${".join(converted_classes)
        return f"className={{`${{{joined}}}`}}"

# Pattern for simple string classNames. 
# It won't catch className={'string'} or className={`string`}, only className="string"
# which covers most legacy code.
new_content = re.sub(r'className="([^"{}]*)"', replacer, content)

with open(file_path, 'w') as f:
    f.write(new_content)

print("Successfully updated className usages in [gameId].tsx")
