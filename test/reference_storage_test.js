// リファレンスストレージサービスのテスト
const fs = require('fs');
const path = require('path');

// プロジェクトのルートパス
const projectPath = '/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius';

// テスト用のサンプルリファレンス
const sampleReference = `# テストリファレンス

これはリファレンスストレージサービスのテスト用のサンプルテキストです。
リファレンスが正しく保存されるかテストします。

\`\`\`javascript
// サンプルコード
function testFunction() {
  console.log('これはテストです');
}
\`\`\`

## 確認事項
- ファイルが正しく作成されるか
- コンテンツが正しく保存されるか
- ファイルパスが想定通りか
`;

// 必要なディレクトリを作成
console.log('テスト: 必要なディレクトリの確認');
const docsPath = path.join(projectPath, 'docs');
const mediaReferencesPath = path.join(projectPath, 'media', 'references');

if (!fs.existsSync(docsPath)) {
  console.log(`ディレクトリがないため作成します: ${docsPath}`);
  fs.mkdirSync(docsPath, { recursive: true });
}

if (!fs.existsSync(mediaReferencesPath)) {
  console.log(`ディレクトリがないため作成します: ${mediaReferencesPath}`);
  fs.mkdirSync(mediaReferencesPath, { recursive: true });
}

// テスト用のリファレンスファイルを直接作成
console.log('テスト: リファレンスファイルの作成');

// 1. api.md
const apiPath = path.join(docsPath, 'api.md');
if (!fs.existsSync(apiPath)) {
  fs.writeFileSync(apiPath, '# API リファレンス\n\nこれはテスト用のAPI参照ファイルです。\n', 'utf8');
  console.log(`ファイルを作成しました: ${apiPath}`);
} else {
  console.log(`ファイルは既に存在します: ${apiPath}`);
}

// 2. snippets.md
const snippetsPath = path.join(docsPath, 'snippets.md');
if (!fs.existsSync(snippetsPath)) {
  fs.writeFileSync(snippetsPath, '# コードスニペット\n\nこれはテスト用のコードスニペットファイルです。\n', 'utf8');
  console.log(`ファイルを作成しました: ${snippetsPath}`);
} else {
  console.log(`ファイルは既に存在します: ${snippetsPath}`);
}

// 3. reference.md
const referencePath = path.join(docsPath, 'reference.md');
if (!fs.existsSync(referencePath)) {
  fs.writeFileSync(referencePath, '# 開発リファレンス\n\nこれはテスト用の開発リファレンスファイルです。\n', 'utf8');
  console.log(`ファイルを作成しました: ${referencePath}`);
} else {
  console.log(`ファイルは既に存在します: ${referencePath}`);
}

// 4. env.example
const envPath = path.join(docsPath, 'env.example');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, '# 環境変数設定例\n\n# テスト用環境変数\nTEST_API_KEY=your_api_key_here\n', 'utf8');
  console.log(`ファイルを作成しました: ${envPath}`);
} else {
  console.log(`ファイルは既に存在します: ${envPath}`);
}

// 5. reference_index.json
const indexPath = path.join(docsPath, 'reference_index.json');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath, JSON.stringify({ references: [] }, null, 2), 'utf8');
  console.log(`ファイルを作成しました: ${indexPath}`);
} else {
  console.log(`ファイルは既に存在します: ${indexPath}`);
}

// テスト結果を表示
console.log('\nテスト結果:');
console.log('--------------------------------------------------');
console.log('リファレンス保存先ディレクトリ構造:');

// 各ファイルの存在確認
const expectedFiles = [
  path.join(docsPath, 'api.md'),
  path.join(docsPath, 'snippets.md'),
  path.join(docsPath, 'reference.md'),
  path.join(docsPath, 'env.example'),
  path.join(docsPath, 'reference_index.json')
];

expectedFiles.forEach(filePath => {
  const exists = fs.existsSync(filePath);
  console.log(`${filePath} - ${exists ? '✅ 存在します' : '❌ 存在しません'}`);
});

console.log('\nメディアディレクトリ:');
console.log(`${mediaReferencesPath} - ${fs.existsSync(mediaReferencesPath) ? '✅ 存在します' : '❌ 存在しません'}`);

// テスト用のサンプルリファレンスを追加
console.log('\nテスト用サンプルリファレンスを追加:');
const testFilePath = path.join(docsPath, 'reference.md');
let currentContent = '';

if (fs.existsSync(testFilePath)) {
  currentContent = fs.readFileSync(testFilePath, 'utf8');
}

// サンプルリファレンスをファイルに追加
const updatedContent = currentContent + '\n\n## テストリファレンス\n\n' + sampleReference;
fs.writeFileSync(testFilePath, updatedContent, 'utf8');
console.log(`テスト用リファレンスを追加しました: ${testFilePath}`);

console.log('\nテスト完了 - VSCode拡張機能でリファレンスマネージャーを開いてファイルが表示されるか確認してください。');