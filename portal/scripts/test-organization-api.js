/**
 * 組織管理API検証ツール
 * Admin APIとの連携および組織管理機能のテストを行います
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const chalk = require('chalk');
const { program } = require('commander');

// モデルをインポート
const Organization = require('../backend/models/organization.model');
const User = require('../backend/models/user.model');
const Workspace = require('../backend/models/workspace.model');

// 設定を取得
const config = {
  dbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api',
  adminApiKey: process.env.ANTHROPIC_ADMIN_KEY,
  testUserId: process.env.TEST_USER_ID
};

// CLIオプション設定
program
  .option('-c, --create', '新しい組織を作成')
  .option('-s, --sync', 'AnthropicからAPIキーと組織データを同期')
  .option('-l, --list', '組織一覧を表示')
  .option('-d, --delete <id>', '指定した組織を削除')
  .option('-w, --workspaces <orgId>', '組織のワークスペース一覧を表示');

program.parse(process.argv);
const options = program.opts();

// データベース接続
async function connectDB() {
  console.log(chalk.blue('データベースに接続中...'));
  try {
    await mongoose.connect(config.dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(chalk.green('データベース接続成功'));
  } catch (error) {
    console.error(chalk.red('データベース接続エラー:'), error);
    process.exit(1);
  }
}

// API呼び出し用のHTTPクライアント
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

// -------------------- 組織管理機能テスト --------------------

// 組織一覧を取得
async function listOrganizations() {
  console.log(chalk.blue('組織一覧を取得中...'));
  
  try {
    const organizations = await Organization.find({
      isArchived: false
    }).populate('adminId', 'username email');
    
    console.log(chalk.green(`${organizations.length}件の組織が見つかりました`));
    
    organizations.forEach(org => {
      console.log(chalk.cyan(`\n組織ID: ${org._id}`));
      console.log(`名前: ${org.name}`);
      console.log(`管理者: ${org.adminId.username} (${org.adminId.email})`);
      console.log(`メンバー数: ${org.members.length}`);
      console.log(`月間予算: ${org.monthlyBudget.toLocaleString()}トークン`);
      console.log(`作成日: ${org.createdAt}`);
    });
  } catch (error) {
    console.error(chalk.red('組織一覧取得エラー:'), error);
  }
}

// 新規組織を作成
async function createOrganization() {
  if (!config.testUserId) {
    console.error(chalk.red('TEST_USER_ID環境変数が設定されていません'));
    return;
  }
  
  console.log(chalk.blue('新しい組織を作成中...'));
  
  try {
    // テストユーザーを取得
    const user = await User.findById(config.testUserId);
    if (!user) {
      console.error(chalk.red('テストユーザーが見つかりません'));
      return;
    }
    
    // 組織名を生成
    const orgName = `テスト組織 ${new Date().toISOString().slice(0, 10)}`;
    
    // 組織を作成
    const organization = new Organization({
      name: orgName,
      description: 'APIテスト用に作成された組織です',
      adminId: user._id,
      monthlyBudget: 100000,
      members: [{ userId: user._id, role: 'admin', joinedAt: new Date() }]
    });
    
    await organization.save();
    
    console.log(chalk.green('組織が正常に作成されました'));
    console.log(chalk.cyan(`組織ID: ${organization._id}`));
    console.log(`名前: ${organization.name}`);
    
    // デフォルトワークスペースを作成
    const workspace = new Workspace({
      name: 'デフォルトワークスペース',
      organizationId: organization._id,
      description: 'デフォルトワークスペース',
      monthlyBudget: organization.monthlyBudget,
      members: [{ userId: user._id, role: 'workspace_admin', joinedAt: new Date() }]
    });
    
    await workspace.save();
    
    console.log(chalk.green('デフォルトワークスペースが作成されました'));
    console.log(chalk.cyan(`ワークスペースID: ${workspace._id}`));
  } catch (error) {
    console.error(chalk.red('組織作成エラー:'), error);
  }
}

// Anthropicからデータを同期
async function syncFromAnthropic() {
  if (!config.adminApiKey) {
    console.error(chalk.red('ANTHROPIC_ADMIN_KEY環境変数が設定されていません'));
    return;
  }
  
  console.log(chalk.blue('Anthropicからデータを同期中...'));
  
  try {
    // Admin APIサービスをインポート
    const anthropicAdminService = require('../backend/services/anthropicAdminService');
    
    // 組織を取得
    const organizations = await Organization.find({
      adminApiKey: { $exists: true, $ne: null }
    });
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('Admin APIキーが設定された組織が見つかりません'));
      return;
    }
    
    // 各組織のワークスペースを同期
    for (const org of organizations) {
      console.log(chalk.cyan(`\n組織「${org.name}」のデータを同期中...`));
      
      // ワークスペース同期
      const workspaceResults = await anthropicAdminService.syncOrganizationWorkspaces(org._id);
      console.log(chalk.green(`${workspaceResults.length}件のワークスペースを同期しました`));
      
      // APIキー同期
      const apiKeyResults = await anthropicAdminService.syncOrganizationApiKeys(org._id);
      console.log(chalk.green(`${apiKeyResults.length}件のAPIキーを同期しました`));
    }
  } catch (error) {
    console.error(chalk.red('同期エラー:'), error);
  }
}

// 組織を削除
async function deleteOrganization(orgId) {
  console.log(chalk.blue(`組織ID: ${orgId} を削除中...`));
  
  try {
    // 組織を取得
    const organization = await Organization.findById(orgId);
    if (!organization) {
      console.error(chalk.red('指定された組織が見つかりません'));
      return;
    }
    
    // 関連するワークスペースを取得
    const workspaces = await Workspace.find({ organizationId: orgId });
    
    // 確認メッセージ
    console.log(chalk.yellow(`警告: 組織「${organization.name}」とその${workspaces.length}個のワークスペースを削除します`));
    console.log(chalk.yellow('このアクションは元に戻せません'));
    
    // 本番環境では確認プロンプトを追加するべき
    
    // ワークスペースを削除
    for (const workspace of workspaces) {
      await workspace.remove();
    }
    
    // 組織を削除
    await organization.remove();
    
    console.log(chalk.green('組織と関連するワークスペースが正常に削除されました'));
  } catch (error) {
    console.error(chalk.red('組織削除エラー:'), error);
  }
}

// 組織のワークスペース一覧を取得
async function listWorkspaces(orgId) {
  console.log(chalk.blue(`組織ID: ${orgId} のワークスペース一覧を取得中...`));
  
  try {
    // 組織を取得
    const organization = await Organization.findById(orgId);
    if (!organization) {
      console.error(chalk.red('指定された組織が見つかりません'));
      return;
    }
    
    // ワークスペースを取得
    const workspaces = await Workspace.find({
      organizationId: orgId,
      isArchived: false
    }).populate('members.userId', 'username email');
    
    console.log(chalk.green(`組織「${organization.name}」の${workspaces.length}件のワークスペースが見つかりました`));
    
    workspaces.forEach(ws => {
      console.log(chalk.cyan(`\nワークスペースID: ${ws._id}`));
      console.log(`名前: ${ws.name}`);
      console.log(`説明: ${ws.description}`);
      console.log(`月間予算: ${ws.monthlyBudget.toLocaleString()}トークン`);
      console.log(`メンバー数: ${ws.members.length}`);
      
      if (ws.apiKey && ws.apiKey.keyId) {
        console.log(`APIキー: ${ws.apiKey.keyId} (${ws.apiKey.status})`);
      } else {
        console.log(`APIキー: 未設定`);
      }
      
      console.log(`作成日: ${ws.createdAt}`);
    });
  } catch (error) {
    console.error(chalk.red('ワークスペース一覧取得エラー:'), error);
  }
}

// メイン実行関数
async function main() {
  try {
    await connectDB();
    
    if (options.list) {
      await listOrganizations();
    } else if (options.create) {
      await createOrganization();
    } else if (options.sync) {
      await syncFromAnthropic();
    } else if (options.delete) {
      await deleteOrganization(options.delete);
    } else if (options.workspaces) {
      await listWorkspaces(options.workspaces);
    } else {
      console.log(chalk.yellow('実行するコマンドを指定してください。ヘルプを表示するには -h オプションを使用してください。'));
    }
  } catch (error) {
    console.error(chalk.red('エラーが発生しました:'), error);
  } finally {
    // データベース接続を閉じる
    await mongoose.connection.close();
    console.log(chalk.blue('データベース接続を閉じました'));
  }
}

// スクリプト実行
main();