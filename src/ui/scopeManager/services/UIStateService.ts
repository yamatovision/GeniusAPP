import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface UIState {
  selectedScopeIndex?: number;
  directoryStructure?: string;
  markdownContent?: string;
  isProjectNavCollapsed?: boolean;
}

export interface IUIStateService {
  getUIState(projectId: string): UIState;
  updateUIState(projectId: string, state: Partial<UIState>): void;
  onUIStateChanged: vscode.Event<{ projectId: string, state: UIState }>;
}

export class UIStateService implements IUIStateService {
  private _onUIStateChanged = new vscode.EventEmitter<{ projectId: string, state: UIState }>();
  public readonly onUIStateChanged = this._onUIStateChanged.event;
  
  private _projectUIStates: Map<string, UIState> = new Map();
  
  private static _instance: UIStateService;
  
  public static getInstance(): UIStateService {
    if (!UIStateService._instance) {
      UIStateService._instance = new UIStateService();
    }
    return UIStateService._instance;
  }
  
  private constructor() {}
  
  public getUIState(projectId: string): UIState {
    return this._projectUIStates.get(projectId) || {};
  }
  
  public updateUIState(projectId: string, state: Partial<UIState>): void {
    try {
      const currentState = this._projectUIStates.get(projectId) || {};
      const newState = { ...currentState, ...state };
      
      // 状態を更新
      this._projectUIStates.set(projectId, newState);
      
      // イベントを発火
      this._onUIStateChanged.fire({ projectId, state: newState });
      
      Logger.info(`UIStateService: UI状態を更新しました: プロジェクト=${projectId}`);
    } catch (error) {
      Logger.error(`UIStateService: UI状態の更新に失敗しました: ${(error as Error).message}`, error as Error);
    }
  }
}