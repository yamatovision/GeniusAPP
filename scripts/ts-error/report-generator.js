#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  logsDir: path.join(__dirname, 'logs'),
  errorsFile: path.join(__dirname, 'logs', 'errors_latest.json'),
  activeFixesFile: path.join(__dirname, 'active-fixes.json')
};

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

// 優先度を計算
function calculatePriority(pattern) {
  let priority = 0;
  
  // 自動化レベル
  if (pattern.automationLevel === 'high') priority += 30;
  else if (pattern.automationLevel === 'medium') priority += 20;
  else priority += 10;
  
  // リスクレベル（低い方が優先度高い）
  if (pattern.riskLevel === 'low') priority += 20;
  else if (pattern.riskLevel === 'medium') priority += 10;
  else priority += 5;
  
  // 信頼性
  if (pattern.confidence === 'very_high') priority += 20;
  else if (pattern.confidence === 'high') priority += 15;
  else if (pattern.confidence === 'medium') priority += 10;
  else priority += 5;
  
  // エラー数
  priority += Math.min(pattern.count || 0, 50); // 最大50点
  
  return priority;
}

// メイン処理
function main() {
  console.log('📊 TypeScriptエラーレポートを生成します...\n');
  
  const errors = loadJsonFile(CONFIG.errorsFile);
  const activeFixes = loadJsonFile(CONFIG.activeFixesFile, { activeFixes: {}, completedFixes: {} });
  
  if (!errors.timestamp) {
    console.error('❌ エラーデータが見つかりません。先に npm run ts:check を実行してください。');
    process.exit(1);
  }
  
  console.log(`📅 分析日時: ${new Date(errors.timestamp).toLocaleString('ja-JP')}`);
  console.log(`📊 総エラー数: ${errors.totalErrors}\n`);
  
  // エラーがない場合
  if (errors.totalErrors === 0) {
    console.log('🎉 TypeScriptエラーはありません！素晴らしい状態です。');
    return;
  }
  
  // ディレクトリ別エラー数
  console.log('📂 ディレクトリ別エラー数:');
  console.log('================================');
  for (const [dir, count] of Object.entries(errors.errorsByDirectory || {})) {
    const dirName = path.basename(dir);
    console.log(`  ${dirName.padEnd(15)} ${count.toString().padStart(3)}エラー`);
  }
  console.log('');
  
  // エラータイプ別
  console.log('🔍 エラータイプ別:');
  console.log('================================');
  const sortedErrorTypes = Object.entries(errors.errorsByType || {})
    .sort(([,a], [,b]) => b.count - a.count);
  
  for (const [code, info] of sortedErrorTypes.slice(0, 10)) {
    console.log(`  ${code.padEnd(8)} ${info.count.toString().padStart(3)}件 - ${info.description}`);
  }
  console.log('');
  
  // パターン分析結果
  if (errors.patterns && Object.keys(errors.patterns).length > 0) {
    console.log('🎯 修正可能なパターン:');
    console.log('================================');
    
    const sortedPatterns = Object.entries(errors.patterns)
      .map(([key, pattern]) => ({
        key,
        ...pattern,
        priority: calculatePriority(pattern)
      }))
      .sort((a, b) => b.priority - a.priority);
    
    for (const pattern of sortedPatterns) {
      console.log(`\n📋 ${pattern.key} (優先度: ${pattern.priority})`);
      console.log(`   📝 説明: ${pattern.description}`);
      console.log(`   📊 エラー数: ${pattern.count}件`);
      console.log(`   🎛️  自動化レベル: ${pattern.automationLevel}`);
      console.log(`   ⚠️  リスクレベル: ${pattern.riskLevel}`);
      console.log(`   ✅ 信頼性: ${pattern.confidence || 'medium'}`);
      console.log(`   📁 影響ファイル数: ${pattern.files ? pattern.files.length : 0}ファイル`);
      
      if (pattern.examples) {
        console.log(`   💡 修正例:`);
        for (const [exampleKey, example] of Object.entries(pattern.examples)) {
          if (example.before && example.after) {
            console.log(`      ${exampleKey}:`);
            console.log(`        ❌ 修正前: ${example.before}`);
            console.log(`        ✅ 修正後: ${example.after}`);
          }
        }
      }
      
      // 自動修正の推奨度
      if (pattern.automationLevel === 'high' && pattern.riskLevel === 'low') {
        console.log(`   🚀 推奨: npm run ts:fix で自動修正可能`);
      } else {
        console.log(`   ⚡ 推奨: 手動修正が必要`);
      }
    }
  }
  
  // アクティブな修正の表示
  if (Object.keys(activeFixes.activeFixes || {}).length > 0) {
    console.log('\n🔄 現在修正中:');
    console.log('================================');
    for (const [fixKey, fix] of Object.entries(activeFixes.activeFixes)) {
      const timeDiff = Date.now() - new Date(fix.startTime).getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      console.log(`  🔧 ${fix.pattern}`);
      console.log(`     👤 修正者: ${fix.agent}`);
      console.log(`     ⏰ 開始時刻: ${minutesDiff}分前`);
      console.log(`     📁 影響ファイル: ${fix.affectedFiles ? fix.affectedFiles.length : 0}ファイル`);
    }
  }
  
  // 最近完了した修正の表示
  const recentCompletedFixes = Object.entries(activeFixes.completedFixes || {})
    .filter(([, fix]) => {
      const timeDiff = Date.now() - new Date(fix.endTime).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff < 24; // 24時間以内
    })
    .sort(([,a], [,b]) => new Date(b.endTime) - new Date(a.endTime));
  
  if (recentCompletedFixes.length > 0) {
    console.log('\n✅ 最近完了した修正 (24時間以内):');
    console.log('================================');
    for (const [fixKey, fix] of recentCompletedFixes.slice(0, 5)) {
      const timeDiff = Date.now() - new Date(fix.endTime).getTime();
      const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
      const statusIcon = fix.status === 'completed' ? '✅' : '❌';
      console.log(`  ${statusIcon} ${fix.pattern}`);
      console.log(`     👤 修正者: ${fix.agent}`);
      console.log(`     ⏰ 完了時刻: ${hoursDiff}時間前`);
      console.log(`     📁 影響ファイル: ${fix.affectedFiles ? fix.affectedFiles.length : 0}ファイル`);
    }
  }
  
  // 重複作業の警告
  if (errors.duplicateWorkWarnings && errors.duplicateWorkWarnings.length > 0) {
    console.log('\n⚠️  重複作業の警告:');
    console.log('================================');
    for (const warning of errors.duplicateWorkWarnings) {
      console.log(`  🚨 ${warning.pattern}`);
      console.log(`     💬 ${warning.recommendation}`);
    }
  }
  
  // 推奨アクション
  console.log('\n🎯 推奨アクション:');
  console.log('================================');
  
  if (errors.patterns && Object.keys(errors.patterns).length > 0) {
    const autoFixablePatterns = Object.values(errors.patterns)
      .filter(p => p.automationLevel === 'high' && p.riskLevel === 'low');
    
    if (autoFixablePatterns.length > 0) {
      const totalAutoFixable = autoFixablePatterns.reduce((sum, p) => sum + p.count, 0);
      console.log(`  1. 🚀 npm run ts:fix で ${totalAutoFixable}件のエラーを自動修正`);
    }
    
    const manualFixPatterns = Object.values(errors.patterns)
      .filter(p => p.automationLevel !== 'high' || p.riskLevel !== 'low');
    
    if (manualFixPatterns.length > 0) {
      console.log(`  2. ⚡ 手動修正が必要なパターン: ${manualFixPatterns.length}種類`);
    }
  }
  
  console.log(`  3. 🔍 修正後は npm run ts:check で再確認`);
  console.log(`  4. 📝 変更内容は git diff で確認`);
  console.log(`  5. 🧪 テストの実行を忘れずに`);
  
  console.log('\n📖 詳細な分析結果はこちら:');
  console.log(`   ${CONFIG.errorsFile}`);
}

// エラーハンドリング
main();