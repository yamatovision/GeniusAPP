#!/usr/bin/env node

const { FilePathGenerator } = require('./dist/tools/fileTools');
const logger = require('./dist/utils/logger').logger;

async function testFilePathGenerator() {
  console.log('FilePathGenerator テストを開始します...');
  
  const generator = new FilePathGenerator();
  
  // テスト用のファイルパスと内容
  const testPattern = '9. test_output/example/auth/service.js';
  const testContent = `
/**
 * テスト用サービスクラス
 */
class TestService {
  constructor() {
    this.initialized = true;
  }
  
  async getData() {
    return { status: 'success' };
  }
}

module.exports = new TestService();
`;

  try {
    console.log(`パターン "${testPattern}" でファイルを生成します...`);
    const result = await generator.execute({
      pattern: testPattern,
      content: testContent,
      baseDir: process.cwd()
    });
    
    if (result.success) {
      console.log('ファイル生成成功:', result.filePath);
    } else {
      console.error('ファイル生成失敗:', result.error);
    }
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

testFilePathGenerator();