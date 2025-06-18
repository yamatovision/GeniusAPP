#!/usr/bin/env node

const { Anthropic } = require('@anthropic-ai/sdk');
const chalk = require('chalk').default || require('chalk');
require('dotenv').config();

class RYTLimitTester {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.results = [];
  }

  // テスト用の長文を生成
  generateText(chars) {
    const baseText = 'あ';
    const lines = Math.ceil(chars / 50); // 1行50文字として
    let text = '';
    
    for (let i = 0; i < lines; i++) {
      text += baseText.repeat(Math.min(50, chars - i * 50)) + '\n';
    }
    
    return text;
  }

  // 単一のテストを実行
  async testSingleRequest(charCount) {
    const text = this.generateText(charCount);
    const startTime = Date.now();
    
    console.log(chalk.blue(`\nテスト中: ${charCount}文字 (${(charCount/1024).toFixed(1)}KB)`));
    
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `次のテキストの文字数を数えてください：\n\n${text}`
        }]
      });
      
      const responseTime = Date.now() - startTime;
      console.log(chalk.green(`✓ 成功: ${responseTime}ms`));
      
      return {
        charCount,
        success: true,
        responseTime,
        error: null
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(chalk.red(`✗ 失敗: ${error.message}`));
      
      return {
        charCount,
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  // 段階的にテスト
  async runTests() {
    console.log(chalk.yellow('RYT接続切断テスト開始\n'));
    
    // テストする文字数のリスト
    const testSizes = [
      1000,      // 1KB
      5000,      // 5KB
      10000,     // 10KB
      50000,     // 50KB
      100000,    // 100KB
      200000,    // 200KB
      500000,    // 500KB
      1000000,   // 1MB
      2000000,   // 2MB
      5000000,   // 5MB
    ];
    
    for (const size of testSizes) {
      const result = await this.testSingleRequest(size);
      this.results.push(result);
      
      // エラーが発生したら詳細を表示
      if (!result.success) {
        console.log(chalk.yellow(`\n詳細: ${result.error}`));
        
        // 接続エラーの場合は中断
        if (result.error.includes('connect') || result.error.includes('timeout')) {
          console.log(chalk.red('\n接続エラーが発生しました。これ以上のテストを中止します。'));
          break;
        }
      }
      
      // レート制限回避のため少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 結果のサマリー
    this.showSummary();
  }

  showSummary() {
    console.log(chalk.cyan('\n=== テスト結果サマリー ===\n'));
    
    const successResults = this.results.filter(r => r.success);
    const failedResults = this.results.filter(r => !r.success);
    
    if (successResults.length > 0) {
      const maxSuccess = Math.max(...successResults.map(r => r.charCount));
      console.log(chalk.green(`✓ 成功した最大文字数: ${maxSuccess}文字 (${(maxSuccess/1024).toFixed(1)}KB)`));
    }
    
    if (failedResults.length > 0) {
      const minFailed = Math.min(...failedResults.map(r => r.charCount));
      console.log(chalk.red(`✗ 失敗した最小文字数: ${minFailed}文字 (${(minFailed/1024).toFixed(1)}KB)`));
      console.log(chalk.yellow(`\n推定される制限: ${(minFailed/1024).toFixed(1)}KB付近`));
    }
    
    // 詳細な結果
    console.log(chalk.gray('\n詳細結果:'));
    this.results.forEach(r => {
      const status = r.success ? chalk.green('✓') : chalk.red('✗');
      const kb = (r.charCount/1024).toFixed(1);
      console.log(`${status} ${r.charCount}文字 (${kb}KB) - ${r.responseTime}ms`);
    });
  }
}

// メイン実行
async function main() {
  const tester = new RYTLimitTester();
  
  console.log(chalk.magenta('=== RYT接続切断調査ツール ==='));
  console.log(chalk.gray('Claude APIの文字数制限を段階的にテストします。\n'));
  
  try {
    await tester.runTests();
  } catch (error) {
    console.error(chalk.red('予期しないエラー:'), error);
  }
}

if (require.main === module) {
  main();
}