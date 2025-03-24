/**
 * スコープ項目のステータス
 */
export enum ScopeItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}

/**
 * 実装項目インターフェース
 * AppGeniusStateManager, MarkdownManager, ScopeExporterで共有
 */
export interface IImplementationItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'high' | 'medium' | 'low';
  isSelected?: boolean;
  dependencies: string[];
  status?: ScopeItemStatus;
  progress?: number;
  notes?: string;
  assignee?: string;
  estimatedHours?: number;
  relatedFiles?: string[];
  relatedMockups?: string[];
  relatedRequirements?: string[];
  completed?: boolean; // ScopeExporter用
}

/**
 * スコープデータインターフェース
 * AppGeniusStateManager, MarkdownManager, ScopeExporterで共有
 */
export interface IImplementationScope {
  id: string;
  name?: string;
  description?: string;
  items: IImplementationItem[];
  selectedIds: string[];
  estimatedTime: string;
  totalProgress: number;
  startDate?: string;
  targetDate?: string;
  projectPath: string;
  requirements?: string[];    // ScopeExporter用
  created?: number;           // ScopeExporter用
  updated?: number;           // ScopeExporter用
}

/**
 * グローバル変数の型拡張
 * 認証情報やサービスインスタンスの共有に使用
 */
declare global {
  // アプリケーション用グローバル変数
  var _appgenius_auth_token: string | undefined;
  var _appgenius_simple_auth_service: any;
}