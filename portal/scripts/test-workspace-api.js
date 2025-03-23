/**
 * ワークスペース管理API検証ツール
 * ワークスペース管理機能とAPIキー連携のテストを行います
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
  .option('-c, --create <orgId>', '指定した組織に新しいワークスペースを作成')
  .option('-l, --list <orgId>', '組織のワークスペース一覧を表示')
  .option('-d, --delete <wsId>', '指定したワークスペースを削除')
  .option('-k, --keys <wsId>', 'ワークスペースのAPIキー情報を表示')
  .option('-m, --members <wsId>', 'ワークスペースのメンバー一覧を表示')
  .option('-a, --add-member <wsId>', 'ワークスペースにメンバーを追加')
  .option('-s, --sync <orgId>', '指定した組織のAnthropicワークスペースを同期');

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

// -------------------- ワークスペース管理機能テスト --------------------

// ワークスペース一覧を取得
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
      organizationId: orgId
    }).populate('members.userId', 'username email');
    
    console.log(chalk.green(`組織「${organization.name}」の${workspaces.length}件のワークスペースが見つかりました`));
    
    workspaces.forEach(ws => {
      const archiveStatus = ws.isArchived ? chalk.yellow('[アーカイブ済み]') : '';
      console.log(chalk.cyan(`\nワークスペースID: ${ws._id} ${archiveStatus}`));
      console.log(`名前: ${ws.name}`);
      console.log(`説明: ${ws.description || '(説明なし)'}`);
      console.log(`月間予算: ${ws.monthlyBudget.toLocaleString()}トークン`);
      console.log(`メンバー数: ${ws.members.length}`);
      
      if (ws.apiKey && ws.apiKey.keyId) {
        console.log(`APIキー: ${ws.apiKey.keyId} (${ws.apiKey.status})`);
      } else {
        console.log(`APIキー: 未設定`);
      }
      
      // Anthropic情報
      if (ws.anthropicWorkspaceId) {
        console.log(`Anthropic ID: ${ws.anthropicWorkspaceId}`);
      }
      
      console.log(`作成日: ${ws.createdAt}`);
    });
  } catch (error) {
    console.error(chalk.red('ワークスペース一覧取得エラー:'), error);
  }
}

// 新規ワークスペースを作成
async function createWorkspace(orgId) {
  console.log(chalk.blue(`組織ID: ${orgId} に新しいワークスペースを作成中...`));
  
  try {
    // 組織を取得
    const organization = await Organization.findById(orgId);
    if (!organization) {
      console.error(chalk.red('指定された組織が見つかりません'));
      return;
    }
    
    // ワークスペース名を生成
    const wsName = `テストワークスペース ${new Date().toISOString().slice(0, 10)}`;
    
    // ワークスペースを作成
    const workspace = new Workspace({
      name: wsName,
      organizationId: organization._id,
      description: 'APIテスト用に作成されたワークスペースです',
      monthlyBudget: Math.round(organization.monthlyBudget / 2), // 組織予算の半分
      members: [{ userId: organization.adminId, role: 'workspace_admin', joinedAt: new Date() }]
    });
    
    await workspace.save();
    
    console.log(chalk.green('ワークスペースが正常に作成されました'));
    console.log(chalk.cyan(`ワークスペースID: ${workspace._id}`));
    console.log(`名前: ${workspace.name}`);
    console.log(`組織: ${organization.name}`);
    console.log(`月間予算: ${workspace.monthlyBudget.toLocaleString()}トークン`);
    
    // Anthropicワークスペース作成を提案
    console.log(chalk.yellow('\n注: Anthropicワークスペースを作成するには、--sync オプションを使用してください'));
  } catch (error) {
    console.error(chalk.red('ワークスペース作成エラー:'), error);
  }
}

// ワークスペースを削除（アーカイブ）
async function deleteWorkspace(wsId) {
  console.log(chalk.blue(`ワークスペースID: ${wsId} をアーカイブ中...`));
  
  try {
    // ワークスペースを取得
    const workspace = await Workspace.findById(wsId);
    if (!workspace) {
      console.error(chalk.red('指定されたワークスペースが見つかりません'));
      return;
    }
    
    // 組織を取得
    const organization = await Organization.findById(workspace.organizationId);
    
    // 確認メッセージ
    const orgName = organization ? organization.name : '不明';
    console.log(chalk.yellow(`警告: 組織「${orgName}」のワークスペース「${workspace.name}」をアーカイブします`));
    console.log(chalk.yellow('注: 完全に削除せず、アーカイブ状態に設定します'));
    
    // 本番環境では確認プロンプトを追加するべき
    
    // ワークスペースをアーカイブ
    workspace.isArchived = true;
    await workspace.save();
    
    console.log(chalk.green('ワークスペースが正常にアーカイブされました'));
    
    // 実際の削除方法も提示
    console.log(chalk.yellow('\n注: 完全に削除するには、MongoDBから直接削除する必要があります:'));
    console.log(`db.workspaces.deleteOne({_id: ObjectId("${wsId}")})`);
  } catch (error) {
    console.error(chalk.red('ワークスペースアーカイブエラー:'), error);
  }
}

// ワークスペースのAPIキー情報を表示
async function showWorkspaceKeys(wsId) {
  console.log(chalk.blue(`ワークスペースID: ${wsId} のAPIキー情報を取得中...`));
  
  try {
    // ワークスペースを取得
    const workspace = await Workspace.findById(wsId);
    if (!workspace) {
      console.error(chalk.red('指定されたワークスペースが見つかりません'));
      return;
    }
    
    // 組織を取得
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization || !organization.adminApiKey) {
      console.error(chalk.red('組織のAdmin APIキーが設定されていません'));
      return;
    }
    
    // Admin APIサービスをインポート
    const anthropicAdminService = require('../backend/services/anthropicAdminService');
    
    // 環境変数から暗号化キーを取得
    const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      console.error(chalk.red('API_KEY_ENCRYPTION_SECRET環境変数が設定されていません'));
      return;
    }
    
    // Admin APIキーを復号化
    const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, encryptionSecret);
    
    // ワークスペースのAPIキーを取得
    let apiKeys;
    if (workspace.anthropicWorkspaceId) {
      console.log(chalk.blue(`Anthropic ワークスペース「${workspace.anthropicWorkspaceId}」のAPIキーを取得中...`));
      apiKeys = await anthropicAdminService.listApiKeys(adminApiKey, workspace.anthropicWorkspaceId);
    } else {
      console.log(chalk.blue('Anthropic デフォルトワークスペースのAPIキーを取得中...'));
      apiKeys = await anthropicAdminService.listApiKeys(adminApiKey);
    }
    
    if (!apiKeys.data || apiKeys.data.length === 0) {
      console.log(chalk.yellow('APIキーが見つかりません'));
      return;
    }
    
    console.log(chalk.green(`${apiKeys.data.length}件のAPIキーが見つかりました`));
    
    apiKeys.data.forEach(key => {
      console.log(chalk.cyan(`\nAPIキーID: ${key.id}`));
      console.log(`名前: ${key.name}`);
      console.log(`ヒント: ${key.partial_key_hint}`);
      console.log(`ステータス: ${key.status}`);
      console.log(`作成日: ${key.created_at}`);
      console.log(`作成者: ${key.created_by.id}`);
    });
    
    // ワークスペースのAPIキー設定を表示
    console.log(chalk.blue('\nワークスペースのAPIキー設定:'));
    if (workspace.apiKey && workspace.apiKey.keyId) {
      const wsKey = apiKeys.data.find(k => k.id === workspace.apiKey.keyId);
      if (wsKey) {
        console.log(chalk.green(`設定済み: ${wsKey.name} (${wsKey.partial_key_hint})`));
      } else {
        console.log(chalk.yellow(`設定済み: ${workspace.apiKey.keyId} - 注: このキーはAnthropicに存在しません`));
      }
    } else {
      console.log(chalk.yellow('APIキーが設定されていません'));
      
      // 利用可能なキーがあれば、設定方法を提案
      if (apiKeys.data.length > 0) {
        const activeKey = apiKeys.data.find(k => k.status === 'active');
        if (activeKey) {
          console.log(chalk.green('\n推奨アクション: 以下のコマンドでAPIキーを設定します:'));
          console.log(`db.workspaces.updateOne({_id: ObjectId("${wsId}")}, {$set: {apiKey: {keyId: "${activeKey.id}", name: "${activeKey.name}", status: "${activeKey.status}", createdAt: new Date("${activeKey.created_at}")}}})`);          
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('APIキー情報取得エラー:'), error);
  }
}

// ワークスペースのメンバー一覧を表示
async function showWorkspaceMembers(wsId) {
  console.log(chalk.blue(`ワークスペースID: ${wsId} のメンバー一覧を取得中...`));
  
  try {
    // ワークスペースを取得
    const workspace = await Workspace.findById(wsId).populate('members.userId', 'username email');
    if (!workspace) {
      console.error(chalk.red('指定されたワークスペースが見つかりません'));
      return;
    }
    
    // 組織を取得
    const organization = await Organization.findById(workspace.organizationId);
    const orgName = organization ? organization.name : '不明';
    
    console.log(chalk.green(`ワークスペース「${workspace.name}」(組織: ${orgName})のメンバー一覧`));
    console.log(chalk.cyan(`${workspace.members.length}名のメンバーが登録されています`));
    
    workspace.members.forEach((member, index) => {
      const user = member.userId;
      if (!user) {
        console.log(chalk.yellow(`\n[${index + 1}] 削除されたユーザー`));
        return;
      }
      
      console.log(chalk.cyan(`\n[${index + 1}] ${user.username} (${user.email})`));
      console.log(`役割: ${member.role}`);
      console.log(`参加日: ${member.joinedAt}`);
    });
    
    // Anthropicワークスペースのメンバー取得手順も表示
    if (workspace.anthropicWorkspaceId && organization && organization.adminApiKey) {
      console.log(chalk.blue('\nAnthropicワークスペースメンバー情報も取得できます:'));
      console.log('--sync オプションを使用して同期すると、Anthropicワークスペースメンバー情報も取得できます。');
    }
  } catch (error) {
    console.error(chalk.red('メンバー一覧取得エラー:'), error);
  }
}

// ワークスペースにメンバーを追加
async function addWorkspaceMember(wsId) {
  if (!config.testUserId) {
    console.error(chalk.red('TEST_USER_ID環境変数が設定されていません'));
    return;
  }
  
  console.log(chalk.blue(`ワークスペースID: ${wsId} にメンバーを追加中...`));
  
  try {
    // ワークスペースを取得
    const workspace = await Workspace.findById(wsId);
    if (!workspace) {
      console.error(chalk.red('指定されたワークスペースが見つかりません'));
      return;
    }
    
    // テストユーザーを取得
    const user = await User.findById(config.testUserId);
    if (!user) {
      console.error(chalk.red('テストユーザーが見つかりません'));
      return;
    }
    
    // 既にメンバーかチェック
    if (workspace.members.some(m => m.userId.toString() === user._id.toString())) {
      console.log(chalk.yellow(`ユーザー「${user.username}」は既にワークスペースのメンバーです`));
      return;
    }
    
    // メンバーを追加
    workspace.members.push({
      userId: user._id,
      role: 'workspace_user',
      joinedAt: new Date()
    });
    
    await workspace.save();
    
    console.log(chalk.green(`ユーザー「${user.username}」(${user.email})をワークスペース「${workspace.name}」に追加しました`));
    console.log(`役割: workspace_user`);
    
    // 組織メンバーの確認
    const organization = await Organization.findById(workspace.organizationId);
    if (organization) {
      if (!organization.members.some(m => m.userId.toString() === user._id.toString())) {
        console.log(chalk.yellow(`注: このユーザーは組織「${organization.name}」のメンバーではありません`));
        console.log(chalk.yellow('組織のメンバーにも追加することをお勧めします'));
      }
    }
  } catch (error) {
    console.error(chalk.red('メンバー追加エラー:'), error);
  }
}

// Anthropicワークスペース同期
async function syncWorkspaces(orgId) {
  console.log(chalk.blue(`組織ID: ${orgId} のAnthropicワークスペースを同期中...`));
  
  try {
    // 組織を取得
    const organization = await Organization.findById(orgId);
    if (!organization) {
      console.error(chalk.red('指定された組織が見つかりません'));
      return;
    }
    
    if (!organization.adminApiKey) {
      console.error(chalk.red('組織のAdmin APIキーが設定されていません'));
      return;
    }
    
    // Admin APIサービスをインポート
    const anthropicAdminService = require('../backend/services/anthropicAdminService');
    
    // ワークスペース同期を実行
    const workspaceResults = await anthropicAdminService.syncOrganizationWorkspaces(orgId);
    console.log(chalk.green(`${workspaceResults.length}件のワークスペースを同期しました`));
    
    workspaceResults.forEach(result => {
      const actionColor = result.action === 'created' ? chalk.green : chalk.blue;
      console.log(actionColor(`\n[${result.action}] ${result.name}`));
      console.log(`ID: ${result.id}`);
      console.log(`Anthropic ID: ${result.anthropicId}`);
    });
    
    // APIキー同期も実行
    console.log(chalk.blue('\nAPIキー情報を同期中...'));
    const apiKeyResults = await anthropicAdminService.syncOrganizationApiKeys(orgId);
    console.log(chalk.green(`${apiKeyResults.length}件のAPIキーを同期しました`));
    
    apiKeyResults.forEach(result => {
      console.log(chalk.cyan(`\n[${result.action}] ${result.workspace || 'デフォルト'}`));
      console.log(`APIキーID: ${result.apiKeyId}`);
      console.log(`名前: ${result.name}`);
    });
  } catch (error) {
    console.error(chalk.red('同期エラー:'), error);
  }
}

// メイン実行関数
async function main() {
  try {
    await connectDB();
    
    if (options.list) {
      await listWorkspaces(options.list);
    } else if (options.create) {
      await createWorkspace(options.create);
    } else if (options.delete) {
      await deleteWorkspace(options.delete);
    } else if (options.keys) {
      await showWorkspaceKeys(options.keys);
    } else if (options.members) {
      await showWorkspaceMembers(options.members);
    } else if (options.addMember) {
      await addWorkspaceMember(options.addMember);
    } else if (options.sync) {
      await syncWorkspaces(options.sync);
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