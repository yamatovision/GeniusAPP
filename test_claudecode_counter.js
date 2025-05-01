/**
 * ClaudeCode起動カウンター機能のテストスクリプト
 * 
 * 使い方:
 * 1. バックエンドとフロントエンドの変更を適用した後、このスクリプトを実行する
 * 2. MongoDB接続文字列を.envファイルまたは環境変数に設定する
 * 3. `node test_claudecode_counter.js <userId>`
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB接続設定
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

// APIエンドポイント
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api';

// 以下のSimpleUserスキーマを持つモデルの定義
// 実際のプロジェクトのモデルと同じ構造を持つ必要がある
const SimpleUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'Admin', 'User'],
    default: 'User'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimpleOrganization'
  },
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnthropicApiKey'
  },
  apiKeyValue: {
    type: String
  },
  claudeCodeLaunchCount: {
    type: Number,
    default: 0
  }
});

// モデルの登録
const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);

/**
 * 指定されたユーザーのClaudeCode起動カウンターをインクリメントするテスト
 * @param {string} userId - ユーザーID
 */
async function testIncrementClaudeCodeLaunchCount(userId) {
  try {
    console.log(`=== ClaudeCode起動カウンターテスト - ユーザーID: ${userId} ===`);
    
    // MongoDB接続
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB接続成功');
    
    // 現在のユーザー情報を取得
    const user = await SimpleUser.findById(userId);
    
    if (!user) {
      console.error(`ユーザーが見つかりません: ${userId}`);
      process.exit(1);
    }
    
    console.log(`テスト前のユーザー情報:`);
    console.log(`- 名前: ${user.name}`);
    console.log(`- メール: ${user.email}`);
    console.log(`- 役割: ${user.role}`);
    console.log(`- ClaudeCode起動回数: ${user.claudeCodeLaunchCount || 0}`);
    
    // SimuateClaudeCodeLaunch: カウンターを手動で更新
    console.log(`\nClaudeCode起動をシミュレート中...`);
    
    // 方法1: Mongooseモデルを使用して直接更新
    user.claudeCodeLaunchCount = (user.claudeCodeLaunchCount || 0) + 1;
    await user.save();
    console.log(`Mongooseモデルを使用してカウンターを更新: ${user.claudeCodeLaunchCount}`);
    
    // 更新後のユーザー情報を取得
    const updatedUser = await SimpleUser.findById(userId);
    
    console.log(`\nテスト後のユーザー情報:`);
    console.log(`- 名前: ${updatedUser.name}`);
    console.log(`- メール: ${updatedUser.email}`);
    console.log(`- 役割: ${updatedUser.role}`);
    console.log(`- ClaudeCode起動回数: ${updatedUser.claudeCodeLaunchCount || 0}`);
    
    console.log(`\n=== テスト完了 ===`);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    // MongoDB接続を閉じる
    await mongoose.disconnect();
    console.log('MongoDB接続を閉じました');
  }
}

/**
 * APIエンドポイントを使用してカウンターをインクリメントするテスト
 * (APIが実装されている場合に使用)
 * @param {string} userId - ユーザーID
 * @param {string} token - 認証トークン
 */
async function testApiIncrementClaudeCodeLaunchCount(userId, token) {
  try {
    console.log(`\n=== API経由でClaudeCode起動カウンターテスト - ユーザーID: ${userId} ===`);
    
    // ユーザー情報を取得
    const getUserResponse = await axios.get(`${API_ENDPOINT}/simple/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`API経由で取得したテスト前のユーザー情報:`);
    console.log(`- 名前: ${getUserResponse.data.name}`);
    console.log(`- メール: ${getUserResponse.data.email}`);
    console.log(`- ClaudeCode起動回数: ${getUserResponse.data.claudeCodeLaunchCount || 0}`);
    
    // APIを使用してカウンターをインクリメント
    console.log(`\nAPI経由でClaudeCode起動をシミュレート中...`);
    const incrementResponse = await axios.post(
      `${API_ENDPOINT}/simple/users/${userId}/increment-claude-code-launch`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`API応答:`, incrementResponse.data);
    
    // 更新後のユーザー情報を再取得
    const updatedUserResponse = await axios.get(`${API_ENDPOINT}/simple/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`\nAPI経由で取得したテスト後のユーザー情報:`);
    console.log(`- 名前: ${updatedUserResponse.data.name}`);
    console.log(`- メール: ${updatedUserResponse.data.email}`);
    console.log(`- ClaudeCode起動回数: ${updatedUserResponse.data.claudeCodeLaunchCount || 0}`);
    
    console.log(`\n=== APIテスト完了 ===`);
    
  } catch (error) {
    console.error('APIテスト実行中にエラーが発生しました:', error.response ? error.response.data : error);
  }
}

// メイン実行
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('使用方法: node test_claudecode_counter.js <userId>');
    process.exit(1);
  }
  
  // Mongooseモデルを使用したテスト
  await testIncrementClaudeCodeLaunchCount(userId);
  
  // 以下はAPIテストが必要な場合のみアンコメント
  // const token = 'YOUR_AUTH_TOKEN'; // 有効なトークンが必要
  // await testApiIncrementClaudeCodeLaunchCount(userId, token);
}

main().catch(console.error);