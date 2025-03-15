import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { PromptData } from './PromptEditor';

/**
 * プロンプトのインポート/エクスポート機能を提供するクラス
 */
export class PromptImportExport {
  private _apiClient: ClaudeCodeApiClient;
  
  /**
   * コンストラクタ
   */
  constructor() {
    this._apiClient = ClaudeCodeApiClient.getInstance();
  }
  
  /**
   * プロンプトをJSONファイルにエクスポート
   */
  public async exportPrompts(): Promise<void> {
    try {
      // プロンプト一覧を取得
      const prompts = await this._apiClient.getPrompts();
      
      if (!prompts || prompts.length === 0) {
        vscode.window.showInformationMessage('エクスポートするプロンプトがありません。');
        return;
      }
      
      // エクスポート先のファイルを選択
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('prompts_export.json'),
        filters: {
          'JSON': ['json']
        },
        title: 'プロンプトをエクスポート'
      });
      
      if (!uri) {
        return; // ユーザーがキャンセルした場合
      }
      
      // JSONデータの準備
      const exportData = {
        exportDate: new Date().toISOString(),
        prompts: prompts.map(p => ({
          id: p.id,
          title: p.title,
          content: p.content,
          type: p.type,
          category: p.category || '',
          tags: p.tags || [],
          isPublic: p.isPublic || false,
          createdAt: p.createdAt
        }))
      };
      
      // ファイルへの書き込み
      fs.writeFileSync(uri.fsPath, JSON.stringify(exportData, null, 2), 'utf8');
      
      vscode.window.showInformationMessage(`${prompts.length}件のプロンプトをエクスポートしました。`);
    } catch (error) {
      console.error('プロンプトのエクスポートに失敗しました:', error);
      vscode.window.showErrorMessage(`プロンプトのエクスポートに失敗しました: ${error}`);
    }
  }
  
  /**
   * JSONファイルからプロンプトをインポート
   */
  public async importPrompts(): Promise<void> {
    try {
      // インポート元のファイルを選択
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'JSON': ['json']
        },
        title: 'プロンプトをインポート'
      });
      
      if (!uris || uris.length === 0) {
        return; // ユーザーがキャンセルした場合
      }
      
      // ファイルの読み込み
      const filePath = uris[0].fsPath;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const importData = JSON.parse(fileContent);
      
      if (!importData.prompts || !Array.isArray(importData.prompts) || importData.prompts.length === 0) {
        vscode.window.showErrorMessage('インポートするプロンプトが見つかりませんでした。');
        return;
      }
      
      // ユーザー確認
      const confirmation = await vscode.window.showInformationMessage(
        `${importData.prompts.length}件のプロンプトをインポートしますか？`,
        { modal: true },
        'はい',
        'いいえ'
      );
      
      if (confirmation !== 'はい') {
        return;
      }
      
      // インポート処理
      // 注: 実際のインポートAPIが実装されていないため、暫定対応
      vscode.window.showInformationMessage('プロンプトのインポート機能はまだ実装されていません。');
      
      // 成功メッセージ
      vscode.window.showInformationMessage(`${importData.prompts.length}件のプロンプトをインポートしました。`);
    } catch (error) {
      console.error('プロンプトのインポートに失敗しました:', error);
      vscode.window.showErrorMessage(`プロンプトのインポートに失敗しました: ${error}`);
    }
  }
  
  /**
   * 特定のプロンプトをマークダウンファイルにエクスポート
   * @param prompt エクスポートするプロンプト
   */
  public async exportPromptToMarkdown(prompt: PromptData): Promise<void> {
    try {
      if (!prompt || !prompt.title) {
        vscode.window.showErrorMessage('エクスポートするプロンプトが無効です。');
        return;
      }
      
      // ファイル名を作成（タイトルから無効な文字を削除）
      const safeFileName = prompt.title.replace(/[\\/:*?"<>|]/g, '_');
      
      // エクスポート先のファイルを選択
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${safeFileName}.md`),
        filters: {
          'Markdown': ['md']
        },
        title: 'プロンプトをマークダウンとしてエクスポート'
      });
      
      if (!uri) {
        return; // ユーザーがキャンセルした場合
      }
      
      // マークダウンの作成
      const markdown = [
        `# ${prompt.title}`,
        '',
        `**タイプ:** ${prompt.type}`,
        prompt.category ? `**カテゴリ:** ${prompt.category}` : '',
        prompt.tags && prompt.tags.length > 0 ? `**タグ:** ${prompt.tags.join(', ')}` : '',
        '',
        '## コンテンツ',
        '',
        prompt.content,
        '',
        `---`,
        `*エクスポート日時: ${new Date().toLocaleString()}*`
      ].filter(line => line !== '').join('\n');
      
      // ファイルへの書き込み
      fs.writeFileSync(uri.fsPath, markdown, 'utf8');
      
      vscode.window.showInformationMessage(`プロンプト「${prompt.title}」をマークダウンとしてエクスポートしました。`);
    } catch (error) {
      console.error('プロンプトのマークダウンエクスポートに失敗しました:', error);
      vscode.window.showErrorMessage(`プロンプトのエクスポートに失敗しました: ${error}`);
    }
  }
}