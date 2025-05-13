// toolkit-dependencies.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 主要コンポーネントパス
const components = {
  'ClaudeCodeLauncherService': './src/services/ClaudeCodeLauncherService.ts',
  'ScopeManagerPanel': './src/ui/scopeManager/ScopeManagerPanel.ts',
  'EnvironmentVariablesAssistantPanel': './src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts',
  'DebugDetectivePanel': './src/ui/debugDetective/DebugDetectivePanel.ts'
};

// 依存関係チェック
async function checkDependencies() {
  console.log('AppGenius ツールキット依存関係チェック\n');
  
  for (const [name, filepath] of Object.entries(components)) {
    // ファイルが存在するか確認
    if (!fs.existsSync(filepath)) {
      console.log(`❌ ${name}: ファイルが見つかりません (${filepath})`);
      continue;
    }
    
    // ファイルの最終更新日を取得
    const stats = fs.statSync(filepath);
    const lastModified = stats.mtime.toISOString().split('T')[0];
    
    // ファイルサイズ
    const fileSize = (stats.size / 1024).toFixed(2) + ' KB';
    
    // インポート依存関係を解析
    const content = fs.readFileSync(filepath, 'utf8');
    const imports = content.match(/import.*from\s+['"](.*)['"];?/g) || [];
    
    // ファイル情報を出力
    console.log(`✅ ${name}`);
    console.log(`   パス: ${filepath}`);
    console.log(`   最終更新日: ${lastModified}`);
    console.log(`   サイズ: ${fileSize}`);
    console.log(`   依存: ${imports.length} モジュール`);
  }
  
  // CLAUDE.mdの状態も確認
  const claudeMdPath = './CLAUDE.md';
  if (fs.existsSync(claudeMdPath)) {
    const claudeMdStats = fs.statSync(claudeMdPath);
    console.log(`\n✅ CLAUDE.md`);
    console.log(`   最終更新日: ${claudeMdStats.mtime.toISOString().split('T')[0]}`);
    console.log(`   サイズ: ${(claudeMdStats.size / 1024).toFixed(2)} KB`);
  }

  // TOOLKIT.mdの状態も確認
  const toolkitMdPath = './TOOLKIT.md';
  if (fs.existsSync(toolkitMdPath)) {
    const toolkitMdStats = fs.statSync(toolkitMdPath);
    console.log(`\n✅ TOOLKIT.md`);
    console.log(`   最終更新日: ${toolkitMdStats.mtime.toISOString().split('T')[0]}`);
    console.log(`   サイズ: ${(toolkitMdStats.size / 1024).toFixed(2)} KB`);
  }
  
  // バージョン情報の確認
  const versionPath = './toolkit-version.json';
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    console.log(`\n📦 ツールキットバージョン: ${versionData.version}`);
    
    // コンポーネントの整合性チェック
    console.log('\n🔍 コンポーネント整合性チェック:');
    for (const [name, info] of Object.entries(versionData.components)) {
      const actualPath = components[name];
      if (!actualPath) {
        console.log(`   ⚠️ ${name}: toolkit-version.jsonには存在しますが、components一覧にありません`);
        continue;
      }
      
      if (actualPath !== info.path) {
        console.log(`   ⚠️ ${name}: パスの不一致 (実際: ${actualPath}, 設定: ${info.path})`);
      } else {
        console.log(`   ✓ ${name}: v${info.version} (${info.lastUpdated})`);
      }
    }
  } else {
    console.log('\n❌ toolkit-version.jsonが見つかりません');
  }
}

// スクリプト実行
checkDependencies().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
});