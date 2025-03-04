const path = require('path');
const fs = require('fs');

// 現在のワークスペースディレクトリを表示
console.log('Current directory:', __dirname);
console.log('Working directory:', process.cwd());

// フォルダ構造をチェック
console.log('Files in current directory:');
fs.readdirSync(__dirname).forEach(file => {
  console.log(` - ${file}`);
});

// パス参照をチェック
console.log('\nPath resolution:');
console.log(`package.json exists: ${fs.existsSync(path.join(__dirname, 'package.json'))}`);
console.log(`src/extension.ts exists: ${fs.existsSync(path.join(__dirname, 'src', 'extension.ts'))}`);
console.log(`dist folder exists: ${fs.existsSync(path.join(__dirname, 'dist'))}`);

// VSCode変数チェック用
console.log('\nVSCode variable check will show:');
console.log(`workspaceFolder value should resolve to: ${__dirname}`);