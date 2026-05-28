const fs = require('fs');
const path = require('path');

function processFile(fullPath) {
  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  if (content.includes('fetch(') && (content.includes('`/api/') || content.includes('"/api/') || content.includes("'/api/"))) {
    if (!content.includes('import { apiBase }')) {
      content = 'import { apiBase } from "@/lib/queryClient";\n' + content;
    }
    
    // Replace fetch(`/api/...`) with fetch(`${apiBase}/api/...`)
    content = content.replace(/fetch\(\s*`\/api/g, 'fetch(`${apiBase}/api');
    
    // Replace fetch('/api/...', ...) with fetch(apiBase + '/api/...', ...)
    content = content.replace(/fetch\(\s*'\/api/g, "fetch(apiBase + '/api");
    
    // Replace fetch("/api/...", ...) with fetch(apiBase + "/api/...", ...)
    content = content.replace(/fetch\(\s*\"\/api/g, 'fetch(apiBase + "/api');

    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content);
    console.log('Modified', fullPath);
  }
}

processFile('client/src/lib/auth.ts');
