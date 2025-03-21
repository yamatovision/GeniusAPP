/**
 * AppGenius 分離認証モードトラブルシューティングスクリプト
 * 
 * このスクリプトは分離認証モード（APPGENIUS_USE_ISOLATED_AUTH=true）の問題を診断し、修正します。
 * 主な機能：
 * 1. 環境変数の検出
 * 2. 認証ファイルパスの検証
 * 3. 認証ファイルの同期
 * 4. 権限の修正
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ANSI カラーコード
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';

// 定数
let APPGENIUS_CONFIG_DIR;
let CLAUDE_CONFIG_DIR;

// ユーザーホームディレクトリを取得
const homeDir = os.homedir();

// プラットフォームに応じて認証ディレクトリを設定
if (process.platform === 'darwin') {
  // macOS
  APPGENIUS_CONFIG_DIR = path.join(homeDir, '.appgenius');
  CLAUDE_CONFIG_DIR = path.join(homeDir, '.claude');
  APPGENIUS_ALT_CONFIG_DIR = path.join(homeDir, 'Library', 'Application Support', 'appgenius');
  CLAUDE_ALT_CONFIG_DIR = path.join(homeDir, 'Library', 'Application Support', 'claude-cli');
} else if (process.platform === 'win32') {
  // Windows
  APPGENIUS_CONFIG_DIR = path.join(homeDir, '.appgenius');
  CLAUDE_CONFIG_DIR = path.join(homeDir, '.claude');
  APPGENIUS_ALT_CONFIG_DIR = path.join(homeDir, 'AppData', 'Roaming', 'appgenius');
  CLAUDE_ALT_CONFIG_DIR = path.join(homeDir, 'AppData', 'Roaming', 'claude-cli');
} else {
  // Linux
  APPGENIUS_CONFIG_DIR = path.join(homeDir, '.appgenius');
  CLAUDE_CONFIG_DIR = path.join(homeDir, '.claude');
  APPGENIUS_ALT_CONFIG_DIR = path.join(homeDir, '.config', 'appgenius');
  CLAUDE_ALT_CONFIG_DIR = path.join(homeDir, '.config', 'claude-cli');
}

// 認証ファイルパスを設定
const APPGENIUS_AUTH_FILE = path.join(APPGENIUS_CONFIG_DIR, 'auth.json');
const CLAUDE_AUTH_FILE = path.join(CLAUDE_CONFIG_DIR, 'auth.json');
const APPGENIUS_ALT_AUTH_FILE = path.join(APPGENIUS_ALT_CONFIG_DIR, 'claude-auth.json');
const CLAUDE_ALT_AUTH_FILE = path.join(CLAUDE_ALT_CONFIG_DIR, 'auth.json');

/**
 * 診断情報の出力
 */
function logInfo(message) {
  console.log(`${BLUE}[INFO]${RESET} ${message}`);
}

function logSuccess(message) {
  console.log(`${GREEN}[SUCCESS]${RESET} ${message}`);
}

function logWarning(message) {
  console.log(`${YELLOW}[WARNING]${RESET} ${message}`);
}

function logError(message) {
  console.log(`${RED}[ERROR]${RESET} ${message}`);
}

function logHeader(title) {
  console.log(`\n${MAGENTA}=== ${title} ===${RESET}\n`);
}

/**
 * 環境変数の検出と表示
 */
function checkEnvironmentVariables() {
  logHeader('環境変数の検出');
  
  const isolatedAuthEnv = process.env.APPGENIUS_USE_ISOLATED_AUTH;
  if (isolatedAuthEnv === undefined) {
    logWarning('環境変数 APPGENIUS_USE_ISOLATED_AUTH が設定されていません');
    logInfo('環境変数を設定するには:');
    if (process.platform === 'win32') {
      logInfo('PowerShellで: $env:APPGENIUS_USE_ISOLATED_AUTH="true"');
      logInfo('コマンドプロンプトで: set APPGENIUS_USE_ISOLATED_AUTH=true');
    } else {
      logInfo('ターミナルで: export APPGENIUS_USE_ISOLATED_AUTH=true');
    }
  } else {
    const isEnabled = isolatedAuthEnv.toLowerCase() === 'true';
    if (isEnabled) {
      logSuccess(`環境変数 APPGENIUS_USE_ISOLATED_AUTH が設定されています: ${isolatedAuthEnv} (有効)`);
    } else {
      logWarning(`環境変数 APPGENIUS_USE_ISOLATED_AUTH が設定されていますが、有効ではありません: ${isolatedAuthEnv}`);
    }
  }
  
  // VSCode関連の環境変数があれば表示
  const vsCodeEnvVars = Object.keys(process.env)
    .filter(key => key.toLowerCase().includes('vscode') || key.toLowerCase().includes('code_'))
    .reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {});
  
  if (Object.keys(vsCodeEnvVars).length > 0) {
    logInfo('VSCode関連の環境変数:');
    Object.entries(vsCodeEnvVars).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
  } else {
    logInfo('VSCode関連の環境変数は検出されませんでした');
  }
}

/**
 * ディレクトリとファイルの存在確認
 */
function checkDirectoriesAndFiles() {
  logHeader('ディレクトリとファイルの確認');
  
  // AppGenius設定ディレクトリの確認
  const appGeniusDirExists = fs.existsSync(APPGENIUS_CONFIG_DIR);
  const appGeniusAltDirExists = fs.existsSync(APPGENIUS_ALT_CONFIG_DIR);
  
  if (appGeniusDirExists) {
    logSuccess(`AppGenius設定ディレクトリが存在します: ${APPGENIUS_CONFIG_DIR}`);
    
    try {
      const stats = fs.statSync(APPGENIUS_CONFIG_DIR);
      logInfo(`ディレクトリの権限: ${stats.mode.toString(8).substr(-3)}`);
    } catch (error) {
      logError(`ディレクトリの権限を確認できませんでした: ${error.message}`);
    }
  } else {
    logWarning(`AppGenius設定ディレクトリが存在しません: ${APPGENIUS_CONFIG_DIR}`);
  }
  
  if (appGeniusAltDirExists) {
    logInfo(`AppGenius代替設定ディレクトリが存在します: ${APPGENIUS_ALT_CONFIG_DIR}`);
  }
  
  // AppGenius認証ファイルの確認
  const authFileExists = fs.existsSync(APPGENIUS_AUTH_FILE);
  const authFileAltExists = fs.existsSync(APPGENIUS_ALT_AUTH_FILE);
  
  if (authFileExists) {
    logSuccess(`AppGenius認証ファイルが存在します: ${APPGENIUS_AUTH_FILE}`);
    
    try {
      const stats = fs.statSync(APPGENIUS_AUTH_FILE);
      logInfo(`ファイルの権限: ${stats.mode.toString(8).substr(-3)}`);
      
      try {
        const fileContent = JSON.parse(fs.readFileSync(APPGENIUS_AUTH_FILE, 'utf8'));
        logInfo('ファイルの構造:');
        
        // トークンの存在を確認するが、実際の値は表示しない
        const hasAccessToken = !!fileContent.accessToken;
        const hasRefreshToken = !!fileContent.refreshToken;
        const hasExpiresAt = !!fileContent.expiresAt;
        const hasUpdatedAt = !!fileContent.updatedAt || !!fileContent.syncedAt;
        
        console.log(`  - accessToken: ${hasAccessToken ? '存在します' : '存在しません'}`);
        console.log(`  - refreshToken: ${hasRefreshToken ? '存在します' : '存在しません'}`);
        console.log(`  - expiresAt: ${hasExpiresAt ? fileContent.expiresAt : '存在しません'}`);
        console.log(`  - updatedAt/syncedAt: ${hasUpdatedAt ? (fileContent.updatedAt || fileContent.syncedAt) : '存在しません'}`);
        
        // トークンの状態を確認
        if (hasExpiresAt) {
          const expiresAt = new Date(fileContent.expiresAt);
          const now = new Date();
          if (expiresAt > now) {
            const timeLeft = Math.floor((expiresAt - now) / 1000 / 60);
            logSuccess(`アクセストークンは有効です (あと約${timeLeft}分)`);
          } else {
            logWarning('アクセストークンの有効期限が切れています');
          }
        }
      } catch (error) {
        logError(`ファイルの内容を読み取れませんでした: ${error.message}`);
      }
    } catch (error) {
      logError(`ファイルの権限を確認できませんでした: ${error.message}`);
    }
  } else {
    logWarning(`AppGenius認証ファイルが存在しません: ${APPGENIUS_AUTH_FILE}`);
  }
  
  if (authFileAltExists) {
    logInfo(`AppGenius代替認証ファイルが存在します: ${APPGENIUS_ALT_AUTH_FILE}`);
  }
  
  // ClaudeCode認証ファイルの確認
  const claudeAuthFileExists = fs.existsSync(CLAUDE_AUTH_FILE);
  const claudeAuthFileAltExists = fs.existsSync(CLAUDE_ALT_AUTH_FILE);
  
  if (claudeAuthFileExists) {
    logSuccess(`ClaudeCode認証ファイルが存在します: ${CLAUDE_AUTH_FILE}`);
    
    try {
      const fileContent = JSON.parse(fs.readFileSync(CLAUDE_AUTH_FILE, 'utf8'));
      const hasAccessToken = !!fileContent.accessToken;
      if (hasAccessToken) {
        logInfo('ClaudeCode認証ファイルにアクセストークンが存在します');
      } else {
        logWarning('ClaudeCode認証ファイルにアクセストークンが存在しません');
      }
    } catch (error) {
      logError(`ClaudeCode認証ファイルの読み取りに失敗しました: ${error.message}`);
    }
  } else {
    logWarning(`ClaudeCode認証ファイルが存在しません: ${CLAUDE_AUTH_FILE}`);
  }
  
  if (claudeAuthFileAltExists) {
    logInfo(`ClaudeCode代替認証ファイルが存在します: ${CLAUDE_ALT_AUTH_FILE}`);
  }
}

/**
 * 権限の修正
 */
function fixPermissions() {
  logHeader('ディレクトリと認証ファイルの権限修正');
  
  if (process.platform === 'win32') {
    logInfo('Windowsでは権限の修正をスキップします');
    return;
  }
  
  try {
    // AppGeniusディレクトリの作成と権限修正
    if (!fs.existsSync(APPGENIUS_CONFIG_DIR)) {
      logInfo(`AppGenius設定ディレクトリを作成します: ${APPGENIUS_CONFIG_DIR}`);
      fs.mkdirSync(APPGENIUS_CONFIG_DIR, { recursive: true });
      logSuccess(`AppGenius設定ディレクトリを作成しました: ${APPGENIUS_CONFIG_DIR}`);
    }
    
    try {
      fs.chmodSync(APPGENIUS_CONFIG_DIR, 0o700);
      logSuccess(`AppGenius設定ディレクトリの権限を修正しました (700): ${APPGENIUS_CONFIG_DIR}`);
    } catch (error) {
      logError(`AppGenius設定ディレクトリの権限修正に失敗しました: ${error.message}`);
    }
    
    // 認証ファイルの権限修正
    if (fs.existsSync(APPGENIUS_AUTH_FILE)) {
      try {
        fs.chmodSync(APPGENIUS_AUTH_FILE, 0o600);
        logSuccess(`AppGenius認証ファイルの権限を修正しました (600): ${APPGENIUS_AUTH_FILE}`);
      } catch (error) {
        logError(`AppGenius認証ファイルの権限修正に失敗しました: ${error.message}`);
      }
    }
  } catch (error) {
    logError(`権限修正プロセス中にエラーが発生しました: ${error.message}`);
  }
}

/**
 * 認証ファイルの同期
 */
function syncAuthFiles() {
  logHeader('認証ファイルの同期');
  
  let sourceAuthFile = null;
  let sourceAuthData = null;
  
  // 有効な認証ファイルを探す
  if (fs.existsSync(CLAUDE_AUTH_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CLAUDE_AUTH_FILE, 'utf8'));
      if (data.accessToken) {
        sourceAuthFile = CLAUDE_AUTH_FILE;
        sourceAuthData = data;
        logInfo(`ClaudeCode認証ファイルを使用します: ${CLAUDE_AUTH_FILE}`);
      }
    } catch (error) {
      logWarning(`ClaudeCode認証ファイルの読み取りに失敗しました: ${error.message}`);
    }
  }
  
  if (!sourceAuthFile && fs.existsSync(CLAUDE_ALT_AUTH_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CLAUDE_ALT_AUTH_FILE, 'utf8'));
      if (data.accessToken) {
        sourceAuthFile = CLAUDE_ALT_AUTH_FILE;
        sourceAuthData = data;
        logInfo(`ClaudeCode代替認証ファイルを使用します: ${CLAUDE_ALT_AUTH_FILE}`);
      }
    } catch (error) {
      logWarning(`ClaudeCode代替認証ファイルの読み取りに失敗しました: ${error.message}`);
    }
  }
  
  // 有効な認証ファイルが見つからない場合
  if (!sourceAuthFile) {
    logError('有効な認証ファイルが見つかりません。VSCodeでAppGenius拡張機能にログインしてください。');
    return;
  }
  
  // AppGeniusディレクトリの確認と作成
  if (!fs.existsSync(APPGENIUS_CONFIG_DIR)) {
    logInfo(`AppGenius設定ディレクトリを作成します: ${APPGENIUS_CONFIG_DIR}`);
    fs.mkdirSync(APPGENIUS_CONFIG_DIR, { recursive: true });
  }
  
  // 認証ファイルの作成
  try {
    // AppGenius用の認証データを作成
    const appGeniusAuthData = {
      ...sourceAuthData,
      source: 'appgenius-extension',
      syncedAt: new Date().toISOString(),
      isolatedAuth: true
    };
    
    // 認証ファイルに書き込み
    fs.writeFileSync(APPGENIUS_AUTH_FILE, JSON.stringify(appGeniusAuthData, null, 2), {
      encoding: 'utf8',
      mode: 0o600 // 所有者のみ読み書き可能
    });
    
    logSuccess(`AppGenius認証ファイルを作成しました: ${APPGENIUS_AUTH_FILE}`);
    
    // Unix系システムの場合、権限を設定
    if (process.platform !== 'win32') {
      fs.chmodSync(APPGENIUS_AUTH_FILE, 0o600);
      logSuccess('認証ファイルの権限を設定しました (600)');
    }
  } catch (error) {
    logError(`認証ファイルの作成中にエラーが発生しました: ${error.message}`);
  }
}

/**
 * 環境変数の設定ガイド
 */
function showEnvSetupGuide() {
  logHeader('環境変数の設定ガイド');
  
  logInfo('分離認証モードを有効にするには、以下の環境変数を設定してください:');
  console.log('');
  
  if (process.platform === 'win32') {
    // Windows
    logInfo('Windowsでの設定:');
    console.log('1. システムのプロパティ > 環境変数を開く');
    console.log('2. ユーザー環境変数で新規作成をクリック');
    console.log('3. 変数名: APPGENIUS_USE_ISOLATED_AUTH');
    console.log('4. 変数値: true');
    console.log('');
    console.log('または、PowerShellで次のコマンドを実行:');
    console.log('[Environment]::SetEnvironmentVariable("APPGENIUS_USE_ISOLATED_AUTH", "true", "User")');
    console.log('');
    console.log('または、コマンドプロンプトで次のコマンドを実行:');
    console.log('setx APPGENIUS_USE_ISOLATED_AUTH true');
  } else {
    // Mac/Linux
    logInfo('Mac/Linuxでの設定:');
    console.log('1. ホームディレクトリの .bashrc または .zshrc ファイルを編集');
    console.log('2. 以下の行を追加:');
    console.log('   export APPGENIUS_USE_ISOLATED_AUTH=true');
    console.log('');
    console.log('3. ターミナルを再起動するか、次のコマンドを実行:');
    console.log('   source ~/.bashrc   # bashの場合');
    console.log('   source ~/.zshrc    # zshの場合');
  }
  
  console.log('');
  logInfo('VSCodeでの設定:');
  console.log('1. settings.jsonに以下を追加:');
  console.log('   "terminal.integrated.env.(platform)": {');
  console.log('     "APPGENIUS_USE_ISOLATED_AUTH": "true"');
  console.log('   }');
  console.log('');
  console.log('   ※ (platform)の部分は使用環境に応じて、linux、osx、windowsのいずれかに置き換えてください。');
  console.log('');
  logWarning('注意: 環境変数を設定した後は、VSCodeを再起動してください。');
}

/**
 * 問題の修正案の提案
 */
function suggestFixes() {
  logHeader('問題の修正案');
  
  logInfo('1. 環境変数を設定する:');
  logInfo('   - APPGENIUS_USE_ISOLATED_AUTH=true を設定');
  
  logInfo('\n2. 認証ファイルを同期する:');
  logInfo('   - このスクリプトを再度実行して認証ファイルを同期');
  
  logInfo('\n3. VSCodeを再起動する:');
  logInfo('   - VSCodeを完全に終了して再起動');
  logInfo('   - AppGenius拡張から一度ログアウトして再ログイン');
  
  logInfo('\n4. それでも問題が解決しない場合:');
  logInfo('   - VSCodeの開発者ツールを開いてコンソールエラーを確認（F1キーを押して「開発者ツールを切り替え」を選択）');
  logInfo('   - AppGenius拡張機能のログを確認（F1キーを押して「ログ（拡張機能ホスト）を表示」を選択）');
  logInfo('   - ログに「分離認証モード」や「isolated auth」に関するエラーがないか確認');
}

/**
 * メイン実行関数
 */
function main() {
  console.log('\nAppGenius 分離認証モードトラブルシューティングツール\n');
  console.log('このツールはAppGeniusの分離認証モードの問題を診断・修正します。\n');
  
  try {
    // 環境変数の確認
    checkEnvironmentVariables();
    
    // ディレクトリとファイルの確認
    checkDirectoriesAndFiles();
    
    // 権限の修正
    fixPermissions();
    
    // 認証ファイルの同期
    syncAuthFiles();
    
    // 環境変数の設定ガイド
    showEnvSetupGuide();
    
    // 修正案の提案
    suggestFixes();
  } catch (error) {
    logError(`診断中にエラーが発生しました: ${error.message}`);
  }
  
  console.log('\n診断が完了しました。上記の情報を参考に問題を解決してください。\n');
  console.log('分離認証モードを確認するには、check_token_usage.js スクリプトを実行してください。');
}

// スクリプトの実行
main();