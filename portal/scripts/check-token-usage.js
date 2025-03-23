/**
 * ユーザーのトークン使用量を確認するスクリプト
 * 使用方法:
 * node check-token-usage.js [メールアドレス] [取得件数]
 */

// 必要なモジュール
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB接続URI
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

// ユーザーモデルの定義
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// API使用量モデルの定義
const ApiUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  apiType: String,
  endpoint: String,
  inputTokens: Number,
  outputTokens: Number,
  totalTokens: Number,
  success: Boolean,
  metadata: Object
});

const ApiUsage = mongoose.model('ApiUsage', ApiUsageSchema);

// メイン関数
async function main() {
  try {
    console.log('MongoDBに接続を試行中...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB接続に成功しました!');

    // 検索するメールアドレス (コマンドライン引数またはデフォルト値)
    const emailToCheck = process.argv[2] || 'lisence@mikoto.co.jp';
    console.log(`ユーザー検索中: ${emailToCheck}`);

    // ユーザーを検索
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + emailToCheck + '$', 'i') }
    });

    if (user) {
      console.log(`=== ${user.name}(${user.email}) のトークン使用量 ===`);
      console.log(`ユーザーID: ${user._id}`);
      
      // コレクション一覧を取得
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      console.log('\n使用可能なコレクション:');
      console.log(collectionNames.join(', '));
      
      // apiusages コレクションがあるか確認
      if (collectionNames.includes('apiusages')) {
        console.log('\n=== トークン使用履歴 ===');
        
        // コマンドライン引数から取得件数を設定（デフォルトは10件）
        const limitCount = parseInt(process.argv[3], 10) || 10;
        console.log(`最新${limitCount}件のトークン使用履歴を取得します...`);
        
        // 使用履歴の総数をカウント
        const totalCount = await ApiUsage.countDocuments({ userId: user._id.toString() });
        console.log(`合計 ${totalCount} 件の使用履歴が見つかりました`);
        
        // 最新のトークン使用量記録を取得
        const apiUsages = await ApiUsage.find({ userId: user._id.toString() })
          .sort({ timestamp: -1 })
          .limit(limitCount);
        
        if (apiUsages.length > 0) {
          console.log(`\n最新${apiUsages.length}件のトークン使用履歴:`);
          apiUsages.forEach((usage, index) => {
            console.log(`\n[${index + 1}] ${usage.timestamp.toISOString()}`);
            console.log(`  API種別: ${usage.apiType}`);
            console.log(`  エンドポイント: ${usage.endpoint}`);
            console.log(`  トークン数: 入力=${usage.inputTokens || 0}, 出力=${usage.outputTokens || 0}, 合計=${usage.totalTokens || 0}`);
            if (usage.metadata) {
              console.log(`  メタデータ: ${JSON.stringify(usage.metadata)}`);
            }
          });
          
          // 月間使用量の集計
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          // まずすべての使用量記録を集計（全期間）
          const allTimeStats = await ApiUsage.aggregate([
            {
              $match: {
                userId: user._id.toString()
              }
            },
            {
              $group: {
                _id: null,
                totalTokens: { $sum: '$totalTokens' },
                inputTokens: { $sum: '$inputTokens' },
                outputTokens: { $sum: '$outputTokens' },
                count: { $sum: 1 },
                minDate: { $min: '$timestamp' },
                maxDate: { $max: '$timestamp' }
              }
            }
          ]);
          
          // 今月の使用量集計
          const monthlyStats = await ApiUsage.aggregate([
            {
              $match: {
                userId: user._id.toString(),
                timestamp: { $gte: firstDayOfMonth }
              }
            },
            {
              $group: {
                _id: null,
                totalTokens: { $sum: '$totalTokens' },
                inputTokens: { $sum: '$inputTokens' },
                outputTokens: { $sum: '$outputTokens' },
                count: { $sum: 1 }
              }
            }
          ]);
          
          // 全期間の統計表示
          if (allTimeStats.length > 0) {
            const stats = allTimeStats[0];
            const firstDate = stats.minDate ? stats.minDate.toISOString().split('T')[0] : 'N/A';
            const lastDate = stats.maxDate ? stats.maxDate.toISOString().split('T')[0] : 'N/A';
            console.log(`\n=== 全期間の使用統計（${firstDate} 〜 ${lastDate}） ===`);
            console.log(`合計トークン使用量: ${stats.totalTokens.toLocaleString() || 0} トークン`);
            console.log(`入力トークン: ${stats.inputTokens.toLocaleString() || 0}`);
            console.log(`出力トークン: ${stats.outputTokens.toLocaleString() || 0}`);
            console.log(`記録回数: ${stats.count.toLocaleString()} 回`);
            
            // 平均計算（数値が有効な場合のみ）
            if (stats.count > 0 && stats.totalTokens > 0) {
              const avgTokensPerRequest = stats.totalTokens / stats.count;
              console.log(`リクエストごとの平均トークン数: ${avgTokensPerRequest.toFixed(1)} トークン`);
            }
          } else {
            console.log('\n=== 使用統計が見つかりませんでした ===');
          }
          
          // 月間統計
          if (monthlyStats.length > 0 && monthlyStats[0].totalTokens > 0) {
            console.log(`\n今月の合計使用量: ${monthlyStats[0].totalTokens.toLocaleString()} トークン (${monthlyStats[0].count.toLocaleString()}回の記録)`);
            console.log(`今月の入力トークン: ${monthlyStats[0].inputTokens.toLocaleString() || 0}`);
            console.log(`今月の出力トークン: ${monthlyStats[0].outputTokens.toLocaleString() || 0}`);
          } else {
            console.log('\n今月のトークン使用履歴はありません（トークン数0の記録は除く）');
          }
          
          // 日次使用量も表示
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const dailyStats = await ApiUsage.aggregate([
            {
              $match: {
                userId: user._id.toString(),
                timestamp: { $gte: today }
              }
            },
            {
              $group: {
                _id: null,
                totalTokens: { $sum: '$totalTokens' },
                inputTokens: { $sum: '$inputTokens' },
                outputTokens: { $sum: '$outputTokens' },
                count: { $sum: 1 }
              }
            }
          ]);
          
          if (dailyStats.length > 0 && dailyStats[0].totalTokens > 0) {
            console.log(`今日の使用量: ${dailyStats[0].totalTokens.toLocaleString()} トークン (${dailyStats[0].count.toLocaleString()}回の記録)`);
            console.log(`今日の入力トークン: ${dailyStats[0].inputTokens.toLocaleString() || 0}`);
            console.log(`今日の出力トークン: ${dailyStats[0].outputTokens.toLocaleString() || 0}`);
          } else {
            console.log('今日のトークン使用履歴はありません（トークン数0の記録は除く）');
          }
          
          // ゼロ以外のトークン記録を探す
          const nonZeroRecords = await ApiUsage.find({
            userId: user._id.toString(),
            totalTokens: { $gt: 0 }
          }).sort({ timestamp: -1 }).limit(5);
          
          if (nonZeroRecords.length > 0) {
            console.log('\n=== トークン数が0より大きい最新の記録 ===');
            nonZeroRecords.forEach((usage, index) => {
              console.log(`\n[${index + 1}] ${usage.timestamp.toISOString()}`);
              console.log(`  API種別: ${usage.apiType}`);
              console.log(`  エンドポイント: ${usage.endpoint}`);
              console.log(`  トークン数: 入力=${usage.inputTokens}, 出力=${usage.outputTokens}, 合計=${usage.totalTokens}`);
              if (usage.metadata) {
                console.log(`  メタデータ: ${JSON.stringify(usage.metadata)}`);
              }
            });
          } else {
            console.log('\nトークン数が0より大きい記録は見つかりませんでした');
          }
        } else {
          console.log('トークン使用履歴が見つかりませんでした');
        }
      } else {
        console.log('apiusages コレクションが見つかりませんでした');
      }
    } else {
      console.log(`メールアドレス ${emailToCheck} のユーザーは見つかりませんでした`);
    }
  } catch (error) {
    console.error('MongoDBエラー:', error);
  } finally {
    // 接続終了
    await mongoose.disconnect();
    console.log('\nMongoDB接続を終了しました');
  }
}

// スクリプト実行
main();