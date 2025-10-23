const fs = require('fs');
const timestamp = Date.now();
let html = fs.readFileSync('dist/index.html', 'utf8');
html = html.replace(/href="styles.css"/, `href="styles.css?v=${timestamp}"`);
html = html.replace(/src="game.js"/, `src="game.js?v=${timestamp}"`);
fs.writeFileSync('dist/index.html', html);