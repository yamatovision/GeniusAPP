/**
 * SimpleAuthService グローバル変数を追加するソリューション
 * 
 * このファイルは、SimpleAuthServiceのインスタンスをグローバル変数に保存し、
 * 異なるモジュールでも同じインスタンスを使用できるようにするためのものです。
 */

import * as vscode from 'vscode';
import { SimpleAuthService } from './core/auth/SimpleAuthService';
import { Logger } from './utils/logger';

declare global {
	var _appgenius_simple_auth_service: any;
}

/**
 * SimpleAuthServiceを初期化してグローバル変数に保存する
 * 
 * @param context VSCode拡張コンテキスト
 */
export function initializeGlobalSimpleAuthService(context: vscode.ExtensionContext): void {
  try {
    // SimpleAuthServiceのインスタンスを取得
    const simpleAuthService = SimpleAuthService.getInstance(context);
    
    // グローバル変数に保存
    global._appgenius_simple_auth_service = simpleAuthService;
    
    // 初期化状態を確認（デバッグ用）
    const isAuthenticated = simpleAuthService.isAuthenticated();
    const userName = simpleAuthService.getCurrentUser()?.name || 'なし';
    
    Logger.info(`グローバルSimpleAuthServiceを初期化しました: 認証状態=${isAuthenticated}, ユーザー=${userName}`);
  } catch (error) {
    Logger.error('グローバルSimpleAuthServiceの初期化に失敗しました', error as Error);
  }
}

/**
 * グローバル変数からSimpleAuthServiceを取得する
 * 
 * @param context 初期化に必要なVSCode拡張コンテキスト（インスタンスが存在しない場合に使用）
 * @returns SimpleAuthServiceのインスタンス
 */
export function getGlobalSimpleAuthService(context?: vscode.ExtensionContext): any {
  // グローバル変数にインスタンスが存在するか確認
  if (global._appgenius_simple_auth_service) {
    return global._appgenius_simple_auth_service;
  }
  
  // 存在しない場合で、contextが提供されている場合は初期化を試みる
  if (context) {
    initializeGlobalSimpleAuthService(context);
    return global._appgenius_simple_auth_service;
  }
  
  // それでも存在しない場合は通常のSimpleAuthService.getInstanceを使用
  try {
    return SimpleAuthService.getInstance();
  } catch (error) {
    Logger.error('グローバルSimpleAuthServiceの取得に失敗しました', error as Error);
    return null;
  }
}