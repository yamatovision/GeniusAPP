//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
module.exports = (env, argv) => {
  const skipTypeCheck = env && env.skipTypeCheck;
  const isProduction = argv && argv.mode === 'production';
  
  if (isProduction) {
    process.env.NODE_ENV = 'production';
  }
  
  console.log(`TypeScript型チェック: ${skipTypeCheck ? '無効' : '有効'}`);
  console.log(`ビルドモード: ${isProduction ? '本番' : '開発'}`);
  
  const config = {
    target: 'node', // vscode拡張はNodeJS環境で実行されるので
    mode: 'none', // 'production'または'development'はこのファイルで設定
  
    entry: './src/extension.ts', // 拡張機能のエントリーポイント
    output: {
      // 出力形式は、モジュールをCommonJSスタイル関数で包むECMAScript module（ESM）を生成
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    devtool: process.env.NODE_ENV === 'production' ? 'hidden-source-map' : 'nosources-source-map',
    externals: {
      vscode: 'commonjs vscode' // モジュールとしてのvscodeはバンドルせずに残す
    },
    resolve: {
      // 解決するファイル拡張子の優先順位
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                // 型チェックを制御するオプション
                transpileOnly: skipTypeCheck === true,
                // エラーメッセージをすべて表示
                logInfoToStdOut: true,
                logLevel: 'info'
              }
            }
          ]
        }
      ]
    }
  };
  
  return config;
};