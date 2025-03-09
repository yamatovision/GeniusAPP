// トランザクションプーラー接続設定スクリプト
const fs = require('fs');
const path = require('path');

// .env.localファイルのパス
const envFilePath = path.join(__dirname, '..', '.env.local');

// ファイル内容を読み取り
let envContent = fs.readFileSync(envFilePath, 'utf8');

// トランザクションプーラー接続文字列（ポート6543）
const transactionPoolerUrl = 'postgresql://postgres.pncennkpgvtcjebdtrxp:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

// パスワードを入力するように促す
console.log('Supabaseのパスワードを入力してください:');
process.stdin.on('data', (data) => {
  const password = data.toString().trim();
  
  // パスワードを接続文字列に挿入
  const dbUrl = transactionPoolerUrl.replace('[YOUR-PASSWORD]', password);
  
  // DATABASE_URL更新
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL="${dbUrl}"$1`);
    console.log('DATABASE_URLをトランザクションプーラーに更新しました');
  } else {
    envContent += `\nDATABASE_URL="${dbUrl}"\n`;
    console.log('DATABASE_URLをトランザクションプーラーとして追加しました');
  }
  
  // DIRECT_URL設定を削除（トランザクションプーラー使用時は不要）
  envContent = envContent.replace(/DIRECT_URL=.*(\r?\n|$)/g, '');
  console.log('DIRECT_URL設定を削除しました（トランザクションプーラー使用時は不要）');
  
  // PRISMA_CLIENT_NO_PREPARED_STATEMENTSをtrueに設定
  if (envContent.includes('PRISMA_CLIENT_NO_PREPARED_STATEMENTS=')) {
    envContent = envContent.replace(/PRISMA_CLIENT_NO_PREPARED_STATEMENTS=.*(\r?\n|$)/g, 'PRISMA_CLIENT_NO_PREPARED_STATEMENTS=true$1');
    console.log('PRISMA_CLIENT_NO_PREPARED_STATEMENTS=true に更新しました');
  } else {
    envContent += '\n# Prismaプリペアドステートメント無効化設定\nPRISMA_CLIENT_NO_PREPARED_STATEMENTS=true\n';
    console.log('PRISMA_CLIENT_NO_PREPARED_STATEMENTS=true を追加しました');
  }
  
  // USE_MOCK_DATA=falseに設定
  if (envContent.includes('USE_MOCK_DATA=')) {
    envContent = envContent.replace(/USE_MOCK_DATA=.*(\r?\n|$)/g, 'USE_MOCK_DATA=false$1');
    console.log('USE_MOCK_DATA=false に設定しました');
  } else {
    envContent += '\n# モックデータ使用設定\nUSE_MOCK_DATA=false\n';
    console.log('USE_MOCK_DATA=false を追加しました');
  }
  
  // ファイルに書き込み
  fs.writeFileSync(envFilePath, envContent);
  
  console.log('.env.localファイルを更新しました');
  console.log('\n次のステップを実行してください:');
  console.log('1. Prismaクライアントを再生成: npx prisma generate');
  console.log('2. サーバーを再起動: npm run dev');
  
  process.exit();
});
