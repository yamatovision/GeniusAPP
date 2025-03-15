import * as vscode from 'vscode';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';

/**
 * プロンプトカテゴリを管理するクラス
 * - カテゴリの一覧取得
 * - カテゴリの追加/編集/削除
 * - カテゴリによるフィルタリング機能
 */
export class CategoryManager {
  private _apiClient: ClaudeCodeApiClient;
  private _categories: string[] = [];
  private _selectedCategory: string | null = null;
  
  /**
   * コンストラクタ
   */
  constructor() {
    this._apiClient = ClaudeCodeApiClient.getInstance();
  }
  
  /**
   * 利用可能なすべてのカテゴリを取得
   */
  public async fetchCategories(): Promise<string[]> {
    try {
      // プロンプト一覧を取得し、それからカテゴリを抽出
      const prompts = await this._apiClient.getPrompts();
      
      // プロンプトからユニークなカテゴリリストを作成
      const categorySet = new Set<string>();
      
      // 空でないカテゴリをセットに追加
      prompts.forEach(prompt => {
        if (prompt.category && typeof prompt.category === 'string' && prompt.category.trim() !== '') {
          categorySet.add(prompt.category.trim());
        }
      });
      
      // セットを配列に変換してソート
      this._categories = Array.from(categorySet).sort();
      return this._categories;
    } catch (error) {
      console.error('カテゴリ一覧の取得に失敗しました:', error);
      vscode.window.showErrorMessage('カテゴリ一覧の取得に失敗しました。');
      return [];
    }
  }
  
  /**
   * 現在のカテゴリリストを取得
   */
  public getCategories(): string[] {
    return this._categories;
  }
  
  /**
   * 選択されたカテゴリを設定
   */
  public setSelectedCategory(category: string | null): void {
    this._selectedCategory = category;
  }
  
  /**
   * 現在選択されているカテゴリを取得
   */
  public getSelectedCategory(): string | null {
    return this._selectedCategory;
  }
  
  /**
   * 新しいカテゴリ名の入力を求める
   */
  public async promptForCategory(): Promise<string | undefined> {
    return vscode.window.showInputBox({
      prompt: '新しいカテゴリ名を入力してください',
      placeHolder: 'カテゴリ名',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'カテゴリ名を入力してください';
        }
        return null;
      }
    });
  }
  
  /**
   * クイックピックでカテゴリを選択
   */
  public async selectCategoryFromQuickPick(): Promise<string | undefined> {
    const allCategories = await this.fetchCategories();
    
    // 「すべて」のオプションを追加
    const options = ['すべて', ...allCategories];
    
    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'カテゴリでフィルタ',
      canPickMany: false
    });
    
    if (selected === 'すべて') {
      this.setSelectedCategory(null);
      return undefined;
    }
    
    if (selected) {
      this.setSelectedCategory(selected);
      return selected;
    }
    
    return undefined;
  }
}