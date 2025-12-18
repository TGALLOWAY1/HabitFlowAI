
import os
import re

target_file = '/Users/tjgalloway/Programming Projects 2025/HabitFlowAI/src/components/AddHabitModal.tsx'

with open(target_file, 'r') as f:
    content = f.read()

# 1. Remove toggleAssignedDay definition (approx lines 413-419)
# Pattern: const toggleAssignedDay = ... };
content = re.sub(r'const toggleAssignedDay = \(dayIndex: number\) => \{[^}]+\};', '', content, flags=re.DOTALL)

# 2. Remove daysOfWeek definition (approx line 422)
content = re.sub(r"const daysOfWeek = \['S', 'M', 'T', 'W', 'T', 'F', 'S'\];", '', content)

# 3. Remove assignedDays logic in handleSubmit (lines 191-194)
# } else if (frequency === 'weekly' && goalType === 'boolean' && assignedDays.length > 0) {
#    // For boolean weekly, target is implied by assigned days
#    finalTarget = assignedDays.length;
# }
content = re.sub(r'\} else if \(frequency === \'weekly\' && goalType === \'boolean\' && assignedDays\.length > 0\) \{[^\}]+\}', '', content, flags=re.DOTALL)

# 4. Update payload to not save assignedDays (Line 213 approx)
# assignedDays: frequency === 'daily' ? assignedDays : undefined,
content = content.replace("assignedDays: frequency === 'daily' ? assignedDays : undefined,", "assignedDays: undefined,")
# Also line 244
# assignedDays: frequency === 'weekly' ? assignedDays : undefined,
content = content.replace("assignedDays: frequency === 'weekly' ? assignedDays : undefined,", "assignedDays: undefined,")

# 5. Remove Old Weekly Config Block (lines 977-1069)
# Start marker: {/* 3. Specific Configuration based on Weekly/Type (Only if Regular or Weekly Bundle) */}
# End marker: {/* 4. Configuration for Daily/Total ... */}
# We need to be careful with regex dot matches.
start_marker = "{/* 3. Specific Configuration based on Weekly/Type (Only if Regular or Weekly Bundle) */}"
end_marker = "{/* 4. Configuration for Daily/Total (Legacy support mostly) */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # We want to remove everything from start_idx up to end_idx (exclusive of end marker)
    content = content[:start_idx] + content[end_idx:]
else:
    print("Could not find Old Weekly Config Block markers")

# Clean up empty lines created
content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

with open(target_file, 'w') as f:
    f.write(content)

print("Successfully cleaned AddHabitModal.tsx")
