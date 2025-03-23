/**
 * ユーザーモデルマイグレーションスクリプト
 * 既存のユーザーモデルから新しいモデル構造へのマイグレーションを実行
 * 実行方法: node scripts/migrate-user-model.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// .envファイルを読み込み
dotenv.config();

// DB接続設定
const connectToDatabase = async () => {
  try {
    // MongoDB接続文字列
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';
    console.log(`データベースに接続します: ${mongoUri}`);

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('データベースに接続しました');
    return true;
  } catch (error) {
    console.error('データベース接続エラー:', error.message);
    return false;
  }
};

/**
 * ユーザーモデルをマイグレーション
 * 古いモデル構造から新しいモデル構造に変換
 */
const migrateUserModel = async () => {
  try {
    console.log('ユーザーモデルマイグレーションを開始します...');

    // 古いユーザーモデル
    const OldUser = mongoose.model('User');
    
    // マイグレーション実行をトラッキングするためのカウンター
    let stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };

    // すべてのユーザーを取得
    const users = await OldUser.find({});
    stats.total = users.length;
    console.log(`${users.length}ユーザー見つかりました`);

    // 各ユーザーをマイグレーション
    for (const user of users) {
      try {
        console.log(`ユーザー処理中: ${user.name} (${user.email})`);

        // すでに新スキーマに移行済みかチェック
        if (user.accountStatus) {
          console.log(`${user.email}は既にマイグレーション済みです。スキップします。`);
          stats.skipped++;
          continue;
        }

        // accountStatus（アカウント状態）を設定
        if (user.role === 'unsubscribed') {
          user.accountStatus = 'deactivated';
        } else {
          user.accountStatus = 'active';
        }

        // role（権限）をクリーンアップ
        if (user.role === 'unsubscribed') {
          user.role = 'user'; // 退会済みは権限をユーザーに戻す（状態は別管理）
        }

        // 組織における役割とフラグを設定
        if (user.organizations && user.organizations.primary) {
          // 既存のユーザーにroleが定義されていない場合、デフォルト設定
          if (!user.organizations.role) {
            user.organizations.role = 'member';
          }

          // 権限が'admin'の場合はorganization.roleも'admin'に設定
          if (user.role === 'admin') {
            user.organizations.role = 'admin';
            user.isOrganizationAdmin = true;
          }
        }

        // 設定とプリファレンスの初期化
        if (!user.preferences) {
          user.preferences = {
            theme: 'system',
            language: 'ja',
            notifications: {
              email: { enabled: true, types: ['security', 'usage_alerts'] },
              inApp: { enabled: true, types: ['all'] }
            }
          };
        }

        // previousRefreshTokens配列の追加（トークンローテーション履歴）
        if (!user.previousRefreshTokens) {
          user.previousRefreshTokens = [];
        }

        // 保存
        await user.save();
        console.log(`ユーザーをマイグレーションしました: ${user.email}`);
        stats.migrated++;
      } catch (userError) {
        console.error(`ユーザー(${user.email})のマイグレーション中にエラー:`, userError);
        stats.errors++;
      }
    }

    // 結果出力
    console.log(`マイグレーション完了:
    合計: ${stats.total}
    成功: ${stats.migrated}
    スキップ: ${stats.skipped}
    エラー: ${stats.errors}
    `);

    return stats;
  } catch (error) {
    console.error('マイグレーション実行中にエラー:', error);
    throw error;
  }
};

/**
 * 古いユーザーデータをバックアップ
 */
const backupUserData = async () => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    // バックアップディレクトリがなければ作成
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // タイムスタンプを含むファイル名
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(backupDir, `users-backup-${timestamp}.json`);
    
    // ユーザーデータを取得
    const User = mongoose.model('User');
    const users = await User.find({});
    
    // JSONとして保存
    fs.writeFileSync(backupPath, JSON.stringify(users, null, 2));
    
    console.log(`ユーザーデータをバックアップしました: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('ユーザーデータのバックアップに失敗:', error);
    throw error;
  }
};

/**
 * メインの実行関数
 */
const main = async () => {
  try {
    // データベースに接続
    const connected = await connectToDatabase();
    if (!connected) {
      console.error('データベース接続に失敗したため、処理を中止します');
      process.exit(1);
    }
    
    // ユーザーデータをバックアップ
    await backupUserData();
    
    // マイグレーション実行
    const result = await migrateUserModel();
    
    // 接続を閉じる
    await mongoose.connection.close();
    console.log('データベース接続を閉じました');
    
    console.log('スクリプトの実行を完了しました');
    process.exit(0);
  } catch (error) {
    console.error('スクリプト実行中のエラー:', error);
    
    // エラー時には接続を閉じる
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('エラーのためデータベース接続を閉じました');
    }
    
    process.exit(1);
  }
};

// スクリプト実行
main();