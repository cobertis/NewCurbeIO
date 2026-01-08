import os

file_path = 'server/routes.ts'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    # Update query params extraction
    if 'const { batchId, minScore, status, state, onlyContactable, excludeDnc, search } = req.query;' in line:
        line = line.replace('state, onlyContactable', 'state, zip, onlyContactable')
    
    # Add zip filter condition
    if 'if (status) {' in line and 'conditions.push(eq(leadOperational.status, status as any));' in lines[i+1]:
        new_lines.append(line)
        new_lines.append(lines[i+1])
        new_lines.append(lines[i+2])
        new_lines.append('\n')
        new_lines.append('      if (zip) {\n')
        new_lines.append('        conditions.push(ilike(canonicalPersons.zip, `${zip}%`));\n')
        new_lines.append('      }\n')
        skip = True
        continue
    
    if skip:
        if 'if (excludeDnc === \'true\') {' in line:
            skip = False
        else:
            continue

    # Update SELECT to include ownerName
    if 'ownerUserId: leadOperational.ownerUserId,' in line:
        new_lines.append(line)
        new_lines.append('        ownerName: users.username,\n')
        continue

    # Update JOIN to include users table
    if '.innerJoin(canonicalPersons, and(eq(leadOperational.personId, canonicalPersons.id), eq(canonicalPersons.companyId, companyId)))' in line:
        new_lines.append(line)
        new_lines.append('      .leftJoin(users, eq(leadOperational.ownerUserId, users.id))\n')
        continue

    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
