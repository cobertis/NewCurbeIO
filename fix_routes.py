import sys

file_path = 'server/routes.ts'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Clean up duplicate ownerName in select
import re
content = re.sub(r'(ownerName: users\.username,\s*)+', 'ownerName: users.username,\n        ', content)

# 2. Clean up duplicate leftJoins
content = re.sub(r'(\.leftJoin\(users, eq\(leadOperational\.ownerUserId, users\.id\)\)\s*)+', '.leftJoin(users, eq(leadOperational.ownerUserId, users.id))\n      ', content)

# 3. Clean up enrichedLeads
content = re.sub(r'(ownerName: lead\.ownerName,\s*)+', 'ownerName: lead.ownerName,\n        ', content)

# 4. Fix list response (remove ...lead and ownerName which belong to single lead)
# This is tricky with regex, so we'll look for specific patterns
content = content.replace('res.json({\n        ...lead,\n        ownerName,', 'res.json({')

# 5. Fix single lead response
# We need to make sure ownerName is fetched and returned
# Locate the single lead GET route
target = 'app.get("/api/leads/operational/:id"'
if target in content:
    # We'll handle this separately if needed, but for now let's just fix the breakage
    pass

with open(file_path, 'w') as f:
    f.write(content)
