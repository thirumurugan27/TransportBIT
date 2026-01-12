const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'client', 'src');
const oldString = 'const API_BASE = "http://localhost:8080";';
const newString = 'const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";';

function walk(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            walk(filePath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes(oldString)) {
                content = content.replace(oldString, newString);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        }
    });
}

console.log('Starting API_BASE update...');
walk(targetDir);
console.log('Done.');
