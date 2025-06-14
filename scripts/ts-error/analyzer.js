#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 設定
const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  logsDir: path.join(__dirname, 'logs'),
  fixPatternsFile: path.join(__dirname, 'fix-patterns.json'),
  activeFixesFile: path.join(__dirname, 'active-fixes.json'),
  outputFiles: {
    latest: 'errors_latest.json',
    dated: `errors_${new Date().toISOString().split('T')[0]}.json`
  }
};

// ログディレクトリの確認・作成
if (!fs.existsSync(CONFIG.logsDir)) {
  fs.mkdirSync(CONFIG.logsDir, { recursive: true });
}

// 修正パターンを読み込む
function loadFixPatterns() {
  try {
    if (fs.existsSync(CONFIG.fixPatternsFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.fixPatternsFile, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  修正パターンファイルの読み込みに失敗しました:', error.message);
  }
  return {};
}

// アクティブな修正情報を読み込む
function loadActiveFixes() {
  try {
    if (fs.existsSync(CONFIG.activeFixesFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.activeFixesFile, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  アクティブ修正ファイルの読み込みに失敗しました:', error.message);
  }
  return { lockInfo: {}, activeFixes: {}, completedFixes: {} };
}

// アクティブな修正情報を保存
function saveActiveFixes(activeFixes) {
  try {
    activeFixes.lockInfo.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG.activeFixesFile, JSON.stringify(activeFixes, null, 2));
  } catch (error) {
    console.error('❌ アクティブ修正ファイルの保存に失敗しました:', error.message);
  }
}

// エラーの重複チェック
function checkForDuplicateWork(errors, activeFixes) {
  const warnings = [];
  const fixPatterns = loadFixPatterns();
  
  for (const error of errors) {
    for (const [patternKey, pattern] of Object.entries(fixPatterns)) {
      const regex = new RegExp(pattern.pattern, 'i');
      const errorText = `${error.errorCode} ${error.message}`;
      
      if (regex.test(errorText)) {
        // アクティブな修正があるかチェック
        const activeFixKey = `${patternKey}-${error.errorCode}`;
        if (activeFixes.activeFixes[activeFixKey]) {
          const activeFix = activeFixes.activeFixes[activeFixKey];
          const timeDiff = Date.now() - new Date(activeFix.startTime).getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          
          if (hoursDiff < 2) { // 2時間以内の修正作業
            warnings.push({
              type: 'duplicate_work_risk',
              pattern: patternKey,
              description: pattern.description,
              activeAgent: activeFix.agent,
              startTime: activeFix.startTime,
              affectedFiles: activeFix.affectedFiles || [],
              recommendation: `この問題は既に${activeFix.agent}によって修正中です。重複作業を避けるため、まず進捗を確認してください。`
            });
          }
        }
        
        // 推奨修正方法を追加
        error.suggestedFix = {
          pattern: patternKey,
          description: pattern.description,
          fixRule: pattern.fixRule,
          examples: pattern.examples,
          automationLevel: pattern.automationLevel,
          riskLevel: pattern.riskLevel,
          confidence: pattern.confidence
        };
        break;
      }
    }
  }
  
  return warnings;
}

// エラーパターンの分析と分類
function analyzeErrorPatterns(errors) {
  const patterns = {};
  const fixPatterns = loadFixPatterns();
  
  for (const error of errors) {
    for (const [patternKey, pattern] of Object.entries(fixPatterns)) {
      const regex = new RegExp(pattern.pattern, 'i');
      const errorText = `${error.errorCode} ${error.message}`;
      
      if (regex.test(errorText)) {
        if (!patterns[patternKey]) {
          patterns[patternKey] = {
            ...pattern,
            count: 0,
            files: new Set(),
            errors: []
          };
        }
        patterns[patternKey].count++;
        patterns[patternKey].files.add(error.file);
        patterns[patternKey].errors.push(error);
        break;
      }
    }
  }
  
  // Setを配列に変換
  for (const pattern of Object.values(patterns)) {
    pattern.files = Array.from(pattern.files);
  }
  
  return patterns;
}

// TypeScriptエラーを収集する関数
function collectTypeScriptErrors(directory, tsconfigPath) {
  return new Promise((resolve, reject) => {
    const errors = [];
    const tscCommand = path.join(directory, 'node_modules', '.bin', 'tsc');
    
    // tscコマンドの存在確認
    if (!fs.existsSync(tscCommand)) {
      console.warn(`⚠️  TypeScript not found in ${directory}`);
      resolve({ directory, errors: [], warning: 'TypeScript not installed' });
      return;
    }

    // Viteプロジェクトの場合はtsconfig.app.jsonを使用
    const tsconfigArgs = directory.includes('frontend') 
      ? ['--noEmit', '--pretty', 'false', '--project', 'tsconfig.app.json']
      : ['--noEmit', '--pretty', 'false'];
    
    const tsc = spawn(tscCommand, tsconfigArgs, {
      cwd: directory,
      shell: true
    });

    let errorOutput = '';

    tsc.stdout.on('data', (data) => {
      errorOutput += data.toString();
    });

    tsc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    tsc.on('close', (code) => {
      if (code !== 0) {
        // エラーをパース
        const lines = errorOutput.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
            if (match) {
              errors.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                errorCode: match[4],
                message: match[5],
                directory: directory,
                hash: crypto.createHash('md5').update(`${match[1]}:${match[2]}:${match[4]}:${match[5]}`).digest('hex')
              });
            }
          }
        }
      }
      resolve({ directory, errors });
    });

    tsc.on('error', (err) => {
      reject(err);
    });
  });
}

// メイン処理
async function main() {
  console.log('🔍 TypeScriptエラー分析を開始します...\n');

  const results = [];
  const activeFixes = loadActiveFixes();
  
  // バックエンドのエラーチェック
  if (fs.existsSync(path.join(CONFIG.rootDir, 'backend', 'tsconfig.json'))) {
    console.log('📁 バックエンドをチェック中...');
    const backendResult = await collectTypeScriptErrors(
      path.join(CONFIG.rootDir, 'backend'),
      path.join(CONFIG.rootDir, 'backend', 'tsconfig.json')
    );
    results.push(backendResult);
  }

  // フロントエンドのエラーチェック（tsconfig.jsonが存在する場合）
  if (fs.existsSync(path.join(CONFIG.rootDir, 'frontend', 'tsconfig.json'))) {
    console.log('📁 フロントエンドをチェック中...');
    const frontendResult = await collectTypeScriptErrors(
      path.join(CONFIG.rootDir, 'frontend'),
      path.join(CONFIG.rootDir, 'frontend', 'tsconfig.json')
    );
    results.push(frontendResult);
  }

  // sajuengine_packageのエラーチェック
  if (fs.existsSync(path.join(CONFIG.rootDir, 'sajuengine_package', 'tsconfig.json'))) {
    console.log('📁 sajuengine_packageをチェック中...');
    const sajuResult = await collectTypeScriptErrors(
      path.join(CONFIG.rootDir, 'sajuengine_package'),
      path.join(CONFIG.rootDir, 'sajuengine_package', 'tsconfig.json')
    );
    results.push(sajuResult);
  }

  // 結果の集計
  const summary = {
    timestamp: new Date().toISOString(),
    totalErrors: 0,
    errorsByDirectory: {},
    errorsByType: {},
    allErrors: [],
    patterns: {},
    duplicateWorkWarnings: []
  };

  for (const result of results) {
    summary.errorsByDirectory[result.directory] = result.errors.length;
    summary.totalErrors += result.errors.length;
    
    for (const error of result.errors) {
      summary.allErrors.push(error);
      
      // エラータイプ別の集計
      if (!summary.errorsByType[error.errorCode]) {
        summary.errorsByType[error.errorCode] = {
          count: 0,
          description: error.message.split('.')[0],
          examples: []
        };
      }
      summary.errorsByType[error.errorCode].count++;
      if (summary.errorsByType[error.errorCode].examples.length < 3) {
        summary.errorsByType[error.errorCode].examples.push({
          file: error.file,
          line: error.line,
          message: error.message
        });
      }
    }
  }

  // パターン分析と重複作業チェック
  summary.patterns = analyzeErrorPatterns(summary.allErrors);
  summary.duplicateWorkWarnings = checkForDuplicateWork(summary.allErrors, activeFixes);

  // 結果をファイルに保存
  const outputPath = path.join(CONFIG.logsDir, CONFIG.outputFiles.latest);
  const datedOutputPath = path.join(CONFIG.logsDir, CONFIG.outputFiles.dated);
  
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(datedOutputPath, JSON.stringify(summary, null, 2));

  // コンソールに結果を表示
  console.log('\n📊 エラー分析結果:\n');
  console.log(`総エラー数: ${summary.totalErrors}`);
  
  // 重複作業警告の表示
  if (summary.duplicateWorkWarnings.length > 0) {
    console.log('\n⚠️  重複作業の警告:');
    for (const warning of summary.duplicateWorkWarnings) {
      console.log(`  🚨 ${warning.pattern}: ${warning.recommendation}`);
    }
  }
  
  console.log('\nディレクトリ別エラー数:');
  for (const [dir, count] of Object.entries(summary.errorsByDirectory)) {
    console.log(`  ${path.basename(dir)}: ${count}エラー`);
  }
  
  if (summary.totalErrors > 0) {
    console.log('\nエラータイプ別:');
    for (const [code, info] of Object.entries(summary.errorsByType)) {
      console.log(`  ${code}: ${info.count}件 - ${info.description}`);
    }

    // パターン分析結果の表示
    console.log('\n🔍 検出されたパターン:');
    for (const [patternKey, pattern] of Object.entries(summary.patterns)) {
      console.log(`  📋 ${patternKey}: ${pattern.count}件`);
      console.log(`     説明: ${pattern.description}`);
      console.log(`     自動化レベル: ${pattern.automationLevel}`);
      console.log(`     リスクレベル: ${pattern.riskLevel}`);
      if (pattern.automationLevel === 'high' && pattern.riskLevel === 'low') {
        console.log(`     ✅ 自動修正推奨`);
      }
    }
  }

  console.log(`\n✅ 結果を保存しました: ${outputPath}`);
  
  // 終了コード
  process.exit(summary.totalErrors > 0 ? 1 : 0);
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});