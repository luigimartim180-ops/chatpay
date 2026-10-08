const fs = require('fs');
const workerPath = 'D:\\chatpay\\worker.js';
const htmlPath = 'D:\\chatpay\\downloads_imported\\chatpay-dash.html';

let worker = fs.readFileSync(workerPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

// Find the start and end of dashPage()
const startToken = 'function dashPage() {';
const startIndex = worker.indexOf(startToken);
if (startIndex === -1) {
    console.error('dashPage() not found');
    process.exit(1);
}

// Find the end of the dashPage function using regex
const endTokenMatch = worker.substring(startIndex).match(/<\/script><\/body><\/html>`\s*;\s*}/);
if (!endTokenMatch) {
    console.error('End of dashPage() not found');
    process.exit(1);
}
const endIndex = startIndex + endTokenMatch.index + endTokenMatch[0].length;

// Construct the new dashPage function
// We need to escape backticks inside the HTML to use it in a template literal.
// We also escape ${ to prevent template interpolation of string content (though not strictly necessary if there are none, better safe).
const escapedHtml = html.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const newDashPage = `function dashPage() {\n  return \`${escapedHtml}\`;\n}`;

const newWorker = worker.substring(0, startIndex) + newDashPage + worker.substring(endIndex);

fs.writeFileSync(workerPath, newWorker, 'utf8');
console.log('Successfully updated dashPage() in worker.js');
