const fs = require('fs');
const path = 'server/routes.ts';
let content = fs.readFileSync(path, 'utf8');

// Find the enrichedLeads map and fix it to include ...lead
// We search for the pattern where ownerName is the first property in the mapped object
const enrichedPattern = /const enrichedLeads = leads\.map\(lead => \(\{[\s\n]+ownerName: lead\.ownerName,/;
const replacement = 'const enrichedLeads = leads.map(lead => ({\n        ...lead,\n        ownerName: lead.ownerName,';

if (enrichedPattern.test(content)) {
    content = content.replace(enrichedPattern, replacement);
    console.log("Successfully fixed enrichedLeads map.");
} else {
    console.log("Could not find enrichedLeads map pattern.");
}

fs.writeFileSync(path, content);
