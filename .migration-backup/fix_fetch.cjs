const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (fullPath.includes('queryClient.ts') || fullPath.includes('api.ts') || fullPath.includes('auth.ts')) continue;
      
      let content = fs.readFileSync(fullPath, 'utf-8');
      let modified = false;

      // Ensure apiBase is imported if we are about to use it
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
  }
}

processDir('client/src');
