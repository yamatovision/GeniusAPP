#!/usr/bin/env node

// BlueLamp CLI ツールテストスクリプト
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testTools() {
  console.log('🧪 BlueLamp CLI ツールテスト開始\n');

  // テスト用ディレクトリを作成
  const testDir = path.join(__dirname, 'test-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  const testFile = path.join(testDir, 'test.txt');
  const testContent = 'これはテストファイルです。';

  console.log('📁 テスト環境準備完了');
  console.log(`テストディレクトリ: ${testDir}`);
  console.log(`テストファイル: ${testFile}\n`);

  // 1. Write ツールテスト
  console.log('📝 Write ツールテスト');
  console.log('期待動作: ファイル作成成功');
  
  // 実際のツール呼び出しをシミュレート
  const testWriteInput = {
    file_path: testFile,
    content: testContent
  };
  
  console.log(`入力パラメータ: ${JSON.stringify(testWriteInput)}`);
  console.log('Claude API呼び出しをシミュレーション...\n');

  // 2. Read ツールテスト  
  console.log('📖 Read ツールテスト');
  console.log('期待動作: ファイル読み込み成功');
  
  const testReadInput = {
    file_path: testFile
  };
  
  console.log(`入力パラメータ: ${JSON.stringify(testReadInput)}\n`);

  // 3. Edit ツールテスト
  console.log('✏️ Edit ツールテスト');
  console.log('期待動作: ファイル編集成功');
  
  const testEditInput = {
    file_path: testFile,
    old_text: 'これは',
    new_text: 'これは修正された'
  };
  
  console.log(`入力パラメータ: ${JSON.stringify(testEditInput)}\n`);

  // 4. Bash ツールテスト
  console.log('⚡ Bash ツールテスト');
  console.log('期待動作: ls コマンド実行成功');
  
  const testBashInput = {
    command: `ls -la ${testDir}`
  };
  
  console.log(`入力パラメータ: ${JSON.stringify(testBashInput)}\n`);

  console.log('🎯 実際のツール動作確認方法:');
  console.log('1. bluelamp を起動');
  console.log(`2. 「${testFile}というファイルにHello Worldと書き込んでください」と入力`);
  console.log(`3. 「${testFile}を読み込んでください」と入力`);
  console.log('4. 「Hello WorldをHello BlueLampに編集してください」と入力');
  console.log(`5. 「ls -la ${testDir}コマンドを実行してください」と入力\n`);

  // クリーンアップ
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
  fs.rmdirSync(testDir);

  console.log('✅ テスト完了（テンプレート）');
}

testTools().catch(console.error);