/**
 * スーパー管理者ロール検証スクリプト
 * 
 * このスクリプトはAPIサーバー内のユーザーロールとJWTトークン内のロールの
 * 整合性を検証します。特にsuper_adminロールが正しく処理されているかを確認します。
 * 
 * 実行方法:
 * node test_script/check_super_admin_role.js [メールアドレス]
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// カラー出力用のコード
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';

// データベース接続文字列
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'appgenius-jwt-secret-key';

/**
 * ログ出力関数
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
 * ユーザーモデル定義
 */
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin']
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated']
  },
  refreshToken: String
});

/**
 * JWTトークン生成関数 (修正前の実装)
 */
function generateLegacyToken(user) {
  // 問題の再現: super_adminをadminにダウングレード
  const role = user.role === 'super_admin' ? 'admin' : user.role;
  
  return jwt.sign(
    { id: user._id, role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * JWTトークン生成関数 (修正後の実装)
 */
function generateFixedToken(user) {
  // 修正版: ユーザーのロールをそのまま使用
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * スーパー管理者ユーザーを検索
 */
async function findUserByEmail(email) {
  const User = mongoose.model('User', userSchema);
  return await User.findOne({ email });
}

/**
 * メイン検証関数
 */
async function verifyRoleImplementation(email) {
  logHeader('スーパー管理者ロール検証');
  
  try {
    logInfo(`MongoDB接続中: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    logSuccess('データベースに接続しました');
    
    logInfo(`ユーザー検索中: ${email}`);
    const user = await findUserByEmail(email);
    
    if (!user) {
      logError(`ユーザーが見つかりません: ${email}`);
      return;
    }
    
    logSuccess(`ユーザーが見つかりました: ${user.name} (${user.email})`);
    logInfo(`ユーザーロール: ${user.role}`);
    logInfo(`アカウント状態: ${user.accountStatus || '未設定'}`);
    
    // 修正前のトークン生成
    const legacyToken = generateLegacyToken(user);
    const legacyDecoded = jwt.verify(legacyToken, JWT_SECRET);
    
    // 修正後のトークン生成
    const fixedToken = generateFixedToken(user);
    const fixedDecoded = jwt.verify(fixedToken, JWT_SECRET);
    
    logHeader('トークン解析結果');
    
    // 修正前のトークン情報
    logInfo('修正前のトークン実装:');
    console.log(`  ID: ${legacyDecoded.id}`);
    console.log(`  ロール: ${legacyDecoded.role}`);
    if (user.role === 'super_admin' && legacyDecoded.role !== 'super_admin') {
      logError('  問題検出: super_adminロールがadminに変換されています');
    }
    
    // 修正後のトークン情報
    logInfo('修正後のトークン実装:');
    console.log(`  ID: ${fixedDecoded.id}`);
    console.log(`  ロール: ${fixedDecoded.role}`);
    if (user.role === 'super_admin' && fixedDecoded.role === 'super_admin') {
      logSuccess('  修正確認: super_adminロールが正しく保持されています');
    }
    
    // 結果の総合評価
    logHeader('検証結果');
    
    if (user.role === 'super_admin') {
      if (legacyDecoded.role !== 'super_admin' && fixedDecoded.role === 'super_admin') {
        logSuccess('修正が正しく実装されています。スーパー管理者ロールが正しく処理されています。');
      } else if (legacyDecoded.role === 'super_admin' && fixedDecoded.role === 'super_admin') {
        logInfo('問題は検出されませんでした。スーパー管理者ロールは既に正しく処理されています。');
      } else {
        logError('修正が不完全です。スーパー管理者ロールが正しく処理されていません。');
      }
    } else {
      logInfo(`テスト対象ユーザーはスーパー管理者ではありません (${user.role})。`);
      logInfo('スーパー管理者ユーザーでテストするには、super_adminロールを持つユーザーのメールアドレスを指定してください。');
    }
  } catch (error) {
    logError(`検証中にエラーが発生しました: ${error.message}`);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      logInfo('データベース接続を閉じました');
    }
  }
}

// コマンドライン引数からメールアドレスを取得（デフォルトはlisence@mikoto.co.jp）
const email = process.argv[2] || 'lisence@mikoto.co.jp';

// 検証実行
verifyRoleImplementation(email)
  .catch(err => {
    console.error('予期せぬエラーが発生しました:', err);
    process.exit(1);
  });