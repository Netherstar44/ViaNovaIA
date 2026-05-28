const fs = require('fs');
const path = require('path');

const filesToFix = [
  'client/src/pages/Home.tsx',
  'client/src/pages/taxi/TaxiDashboard.tsx',
  'client/src/pages/taxi/RequestRide.tsx',
  'client/src/components/TaxiOrderPanel.tsx',
  'client/src/components/Chatbot.tsx'
];

for (const file of filesToFix) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Replace the taxi gradients
  content = content.replace(/bg-gradient-to-r from-primary via-primary\/90 to-emerald-500 text-(black|white)/g, 'bg-primary text-primary-foreground');
  
  // Also just the gradient without text color if there is one
  content = content.replace(/bg-gradient-to-r from-primary via-primary\/90 to-emerald-500/g, 'bg-primary text-primary-foreground');

  // Replace Chatbot gradient
  content = content.replace(/bg-gradient-to-tr from-primary to-yellow-300 text-black/g, 'bg-primary text-primary-foreground');
  
  fs.writeFileSync(fullPath, content);
  console.log('Fixed gradients in', file);
}
