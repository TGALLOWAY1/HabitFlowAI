
import os
import re

target_file = '/Users/tjgalloway/Programming Projects 2025/HabitFlowAI/src/components/TrackerGrid.tsx'

with open(target_file, 'r') as f:
    content = f.read()

# 1. Remove WeeklyHabitRowContent (approx lines 623-851)
# Pattern: const WeeklyHabitRowContent = ... };
# It's a large block. We can regex match it.
# It starts with "const WeeklyHabitRowContent = ({" and ends with "};" at start of line?
content = re.sub(r'const WeeklyHabitRowContent = \(\{[^;]+?\n\};', '', content, flags=re.DOTALL)

# 2. Remove handleOpenChoiceLog (approx lines 1102-1130)
content = re.sub(r'const handleOpenChoiceLog = [^;]+?\n\s*\};', '', content, flags=re.DOTALL)

# Just in case regex fails on large blocks (re module has limits? no usually fine for file size)
# But non-greedy match `[^;]+?` might stop early if there is a `;` inside the function.
# Function likely has `;` inside.
# So we need safer parsing.
# We can find start index and count braces? Or just use known markers from view.

# Fallback: String slicing if regex is risky.
start_marker = "const WeeklyHabitRowContent = ({"
end_marker = "// SortableWeeklyHabitRow removed/commented out"
# The view showed it ends at line 851 with `};`. Then 853 `// SortableWeeklyHabitRow ...`

s_idx = content.find(start_marker)
e_idx = content.find(end_marker)

if s_idx != -1 and e_idx != -1:
    # Remove from s_idx up to e_idx (minus some whitespace)
    # We want to keep e_idx (the comment).
    content = content[:s_idx] + content[e_idx:]
else:
    print("Could not find WeeklyHabitRowContent markers")

# Remove handleOpenChoiceLog
# It starts around 1102.
# Ends before `const handleToggle = ...` ?
# View didn't show what follows.
# Let's try to remove it if it exists.
if "const handleOpenChoiceLog =" in content:
    # We can try to match it specifically.
    pass # I'll leave it for now if I can't be sure of boundaries.
    # Actually, I can search for the next function definition.
    # "const handleToggle ="
    
    start_log = content.find("const handleOpenChoiceLog =")
    # Find next function start "const "
    # or "return ("
    # or just use bracket counting?
    
    # Simple approach: Read file lines and filter?
    pass

# Refined approach reading lines for handleOpenChoiceLog
lines = content.split('\n')
new_lines = []
skip = False
for line in lines:
    if "const WeeklyHabitRowContent = ({" in line:
        skip = True
    if "// SortableWeeklyHabitRow removed/commented out" in line and skip:
        skip = False
    
    if "const handleOpenChoiceLog =" in line:
        skip = True
    # assuming it ends with "};" on a line by itself?
    # View showed:
    # 1220:     };
    # 1222:     const handleToggleToday = ...
    
    # Wait, handleOpenChoiceLog was NOT viewed fully.
    # I'll rely on the regex I tried first or skipped it?
    # If I skip it, lint remains.
    
    if not skip:
        new_lines.append(line)
    
    # If we are skipping handleOpenChoiceLog, when to stop?
    # It ends with `};` at indentation level 4?
    if skip and line.strip() == "};":
        # Check if this is the end of the function.
        # It's heuristic.
        # But WeeklyHabitRowContent end was also `};`.
        skip = False

# This logic is flawed if `skip` handles multiple things.
# Let's rely on `replace` using big chunks if possible, or just the `WeeklyHabitRowContent` for now.
# I'll just remove WeeklyHabitRowContent via search/replace in python with markers.

content = "".join(l + '\n' for l in lines) 
# Wait, this logic was messy.

# Let's just do WeeklyHabitRowContent with explicit cut.
original_content = open(target_file).read()
s_idx = original_content.find("const WeeklyHabitRowContent = ({")
e_idx = original_content.find("// SortableWeeklyHabitRow removed/commented out")

if s_idx != -1 and e_idx != -1:
    original_content = original_content[:s_idx] + original_content[e_idx:]
    
    # Write it back
    with open(target_file, 'w') as f:
        f.write(original_content)
    print("Removed WeeklyHabitRowContent")

else:
    print("Markers not found for WeeklyHabitRowContent")

