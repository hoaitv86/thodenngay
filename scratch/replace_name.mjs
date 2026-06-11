import fs from 'fs';
import path from 'path';

const searchStr = /Alo Thợ/g;
const replaceStr = "Thợ đến ngay";

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.match(searchStr)) {
                content = content.replace(searchStr, replaceStr);
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Replaced in ${fullPath}`);
            }
        }
    }
}

walkDir('./app');
