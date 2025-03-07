// デバッグ探偵パネルのテスト

const vscode = require('vscode');

async function testDebugDetective() {
  try {
    console.log('デバッグ探偵パネルのテストを開始します');
    
    // コマンドを直接実行
    await vscode.commands.executeCommand('appgenius-ai.openDebugDetective');
    
    console.log('デバッグ探偵パネルを開くコマンドを実行しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

module.exports = {
  testDebugDetective
};

// 直接実行する場合
if (require.main === module) {
  testDebugDetective();
}