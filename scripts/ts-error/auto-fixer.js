#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 設定
const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  logsDir: path.join(__dirname, 'logs'),
  fixPatternsFile: path.join(__dirname, 'fix-patterns.json'),
  activeFixesFile: path.join(__dirname, 'active-fixes.json'),
  errorsFile: path.join(__dirname, 'logs', 'errors_latest.json')
};

// セッションIDの生成
const SESSION_ID = `TypeScriptAutoFixer-${uuidv4().split('-')[0]}`;

// ファイルを読み込む
function loadJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`⚠️  ${filePath}の読み込みに失敗しました:`, error.message);
  }
  return defaultValue;
}

// ファイルを保存する
function saveJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ ${filePath}の保存に失敗しました:`, error.message);
    return false;
  }
}

// 修正ロックを取得
function acquireFixLock(patternKey, files, activeFixes) {
  const lockKey = `${patternKey}-auto-fix`;
  
  // 既存のロックをチェック
  if (activeFixes.activeFixes[lockKey]) {
    const existing = activeFixes.activeFixes[lockKey];
    const timeDiff = Date.now() - new Date(existing.startTime).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 2) {
      console.log(`⚠️  ${patternKey}は既に${existing.agent}によって修正中です`);
      return false;
    } else {
      console.log(`🕐 ${patternKey}のロックが期限切れのため、引き継ぎます`);
    }
  }
  
  // ロックを取得
  activeFixes.activeFixes[lockKey] = {
    agent: SESSION_ID,
    startTime: new Date().toISOString(),
    pattern: patternKey,
    affectedFiles: files,
    status: 'in_progress'
  };
  
  saveJsonFile(CONFIG.activeFixesFile, activeFixes);
  console.log(`🔒 ${patternKey}の修正ロックを取得しました`);
  return true;
}

// 修正ロックを解放
function releaseFixLock(patternKey, activeFixes, success = true) {
  const lockKey = `${patternKey}-auto-fix`;
  
  if (activeFixes.activeFixes[lockKey]) {
    const lockInfo = activeFixes.activeFixes[lockKey];
    
    // 完了記録に移動
    activeFixes.completedFixes[lockKey] = {
      ...lockInfo,
      endTime: new Date().toISOString(),
      status: success ? 'completed' : 'failed',
      agent: SESSION_ID
    };
    
    // アクティブリストから削除
    delete activeFixes.activeFixes[lockKey];
    
    saveJsonFile(CONFIG.activeFixesFile, activeFixes);
    console.log(`🔓 ${patternKey}の修正ロックを解放しました (${success ? '成功' : '失敗'})`);
  }
}

// Material-UI Grid v7の自動修正
function fixMaterialUIGrid(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    // パターン1: <Grid item xs={12}> → <Grid size={{ xs: 12 }}>
    const itemWithBreakpoints = /<Grid\s+item\s+([^>]*(?:xs|sm|md|lg|xl)\s*=\s*{[^}]+}[^>]*?)>/g;
    content = content.replace(itemWithBreakpoints, (match, attributes) => {
      changes++;
      // breakpointの属性を抽出
      const sizeProps = {};
      const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl'];
      
      let newAttributes = attributes;
      for (const bp of breakpoints) {
        const regex = new RegExp(`\\b${bp}\\s*=\\s*{([^}]+)}`, 'g');
        const match = regex.exec(attributes);
        if (match) {
          sizeProps[bp] = match[1];
          newAttributes = newAttributes.replace(regex, '').trim();
        }
      }
      
      const sizeStr = Object.keys(sizeProps).length > 0 
        ? `size={{ ${Object.entries(sizeProps).map(([k, v]) => `${k}: ${v}`).join(', ')} }}`
        : '';
      
      return `<Grid ${newAttributes} ${sizeStr}>`.replace(/\s+/g, ' ').trim();
    });
    
    // パターン2: <Grid item> → <Grid>
    content = content.replace(/<Grid\s+item(\s[^>]*)?>/g, (match, attributes) => {
      changes++;
      return attributes ? `<Grid${attributes}>` : '<Grid>';
    });
    
    if (changes > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ ${path.basename(filePath)}: ${changes}箇所を修正`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ ${path.basename(filePath)}の修正に失敗:`, error.message);
    return false;
  }
}

// 自動修正メイン処理
async function main() {
  console.log('🚀 TypeScript自動修正を開始します...\n');
  
  const errors = loadJsonFile(CONFIG.errorsFile);
  const fixPatterns = loadJsonFile(CONFIG.fixPatternsFile);
  const activeFixes = loadJsonFile(CONFIG.activeFixesFile, { activeFixes: {}, completedFixes: {} });
  
  if (!errors.patterns || Object.keys(errors.patterns).length === 0) {
    console.log('📭 修正可能なパターンが見つかりませんでした');
    return;
  }
  
  for (const [patternKey, pattern] of Object.entries(errors.patterns)) {
    if (pattern.automationLevel === 'high' && pattern.riskLevel === 'low') {
      console.log(`\n🔧 ${patternKey}の自動修正を開始...`);
      
      // ロックを取得
      if (!acquireFixLock(patternKey, pattern.files, activeFixes)) {
        continue;
      }
      
      let successCount = 0;
      let totalFiles = pattern.files.length;
      
      try {
        for (const filePath of pattern.files) {
          const fullPath = path.resolve(CONFIG.rootDir, filePath);
          
          if (!fs.existsSync(fullPath)) {
            console.log(`  ⚠️  ファイルが見つかりません: ${filePath}`);
            continue;
          }
          
          // パターン別の修正実行
          let success = false;
          if (patternKey === 'material-ui-grid-v7') {
            success = fixMaterialUIGrid(fullPath);
          }
          
          if (success) {
            successCount++;
          }
        }
        
        console.log(`\n📊 ${patternKey}の修正結果: ${successCount}/${totalFiles}ファイル成功`);
        
        // ロックを解放
        releaseFixLock(patternKey, activeFixes, successCount > 0);
        
      } catch (error) {
        console.error(`❌ ${patternKey}の修正中にエラーが発生:`, error.message);
        releaseFixLock(patternKey, activeFixes, false);
      }
    } else {
      console.log(`⏩ ${patternKey}は手動修正が必要です (自動化レベル: ${pattern.automationLevel}, リスクレベル: ${pattern.riskLevel})`);
    }
  }
  
  console.log('\n🎉 自動修正が完了しました');
  console.log('\n📝 次の手順:');
  console.log('1. npm run ts:check でエラーが減ったか確認');
  console.log('2. git diff で変更内容を確認');
  console.log('3. テストの実行');
  console.log('4. 問題なければコミット');
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ 自動修正中にエラーが発生しました:', error);
  process.exit(1);
});