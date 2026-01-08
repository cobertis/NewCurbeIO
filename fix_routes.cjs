const fs = require('fs');
const path = 'server/routes.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Clean up duplicate ownerName in select
content = content.replace(/(ownerName: users\.username,\s*)+/g, 'ownerName: users.username,\n        ');

// 2. Clean up duplicate leftJoins
content = content.replace(/(\.leftJoin\(users, eq\(leadOperational\.ownerUserId, users\.id\)\)\s*)+/g, '.leftJoin(users, eq(leadOperational.ownerUserId, users.id))\n      ');

// 3. Clean up enrichedLeads
content = content.replace(/(ownerName: lead\.ownerName,\s*)+/g, 'ownerName: lead.ownerName,\n        ');

// 4. Fix list response
content = content.replace(/res\.json\(\{\s+(\.\.\.lead,\s+ownerName,\s+)+/g, 'res.json({\n        ');

fs.writeFileSync(path, content);
