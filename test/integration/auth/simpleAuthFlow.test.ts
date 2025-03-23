/**
 * SimpleAuth 認証フローの統合テスト
 */
import * as vscode from 'vscode';
import * as assert from 'assert';
import { AuthenticationService } from '../../../src/core/auth/AuthenticationService';
import { TokenManager } from '../../../src/core/auth/TokenManager';
import { AuthStorageManager } from '../../../src/utils/AuthStorageManager';
import { Role } from '../../../src/core/auth/roles';

// モックの実装
class MockExtensionContext implements vscode.ExtensionContext {
  subscriptions: { dispose(): any }[] = [];
  workspaceState: vscode.Memento = {
    get: (key: string) => undefined,
    update: (key: string, value: any) => Promise.resolve()
  };
  globalState: vscode.Memento & { setKeysForSync(keys: string[]): void } = {
    get: (key: string) => undefined,
    update: (key: string, value: any) => Promise.resolve(),
    setKeysForSync: (keys: string[]) => {}
  };
  extensionPath: string = '';
  asAbsolutePath: (relativePath: string) => string = (relativePath) => relativePath;
  storagePath: string | undefined = undefined;
  globalStoragePath: string = '/mock/globalStoragePath';
  logPath: string = '';
  extensionUri: vscode.Uri = vscode.Uri.parse('file:///mock');
  extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
  environmentVariableCollection: vscode.EnvironmentVariableCollection = {} as vscode.EnvironmentVariableCollection;
  storageUri: vscode.Uri | undefined = undefined;
  globalStorageUri: vscode.Uri = vscode.Uri.parse('file:///mock/globalStorage');
  logUri: vscode.Uri = vscode.Uri.parse('file:///mock/log');
  secrets: vscode.SecretStorage = new MockSecretStorage();
}

class MockSecretStorage implements vscode.SecretStorage {
  private storage = new Map<string, string>();
  
  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }
  
  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  // EventEmitter for the onDidChange event
  private _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  readonly onDidChange = this._onDidChange.event;
}

// テストコンフィグレーション
const config = {
  testUser: {
    email: 'metavicer2@gmail.com',
    password: 'Mikoto@123'
  }
};

// SimpleAuth 統合テスト
describe('SimpleAuth 認証フロー', function() {
  let context: vscode.ExtensionContext;
  let authService: AuthenticationService;
  
  this.timeout(10000); // テストタイムアウトを10秒に設定
  
  beforeEach(() => {
    // 各テストの前に実行する初期化コード
    context = new MockExtensionContext();
    // TokenManagerとAuthStorageManagerをリセットするためのハック
    (TokenManager as any).instance = undefined;
    (AuthStorageManager as any).instance = undefined;
    
    authService = AuthenticationService.getInstance(context);
  });
  
  // ログインテスト
  it('SimpleAuth ログインが成功すること', async function() {
    // このテストはAPIキーとパスワードが必要なため、CIでスキップさせる
    if (process.env.CI) {
      this.skip();
      return;
    }
    
    const result = await authService.login(config.testUser.email, config.testUser.password);
    assert.strictEqual(result, true, 'ログインに失敗しました');
    
    const state = authService.getCurrentState();
    assert.strictEqual(state.isAuthenticated, true, '認証状態が正しく設定されていません');
    assert.notStrictEqual(state.username, '', 'ユーザー名が設定されていません');
    
    // ロールのチェック
    assert.notStrictEqual(state.role, Role.GUEST, 'ロールがゲストのままです');
  });
  
  // トークンリフレッシュテスト (ログイン後に実行するため、別のテストとして実装)
  it('SimpleAuth トークンリフレッシュが成功すること', async function() {
    // このテストはAPIキーとパスワードが必要なため、CIでスキップさせる
    if (process.env.CI) {
      this.skip();
      return;
    }
    
    // まずログイン
    const loginResult = await authService.login(config.testUser.email, config.testUser.password);
    assert.strictEqual(loginResult, true, 'ログイン前提テストのログインに失敗しました');
    
    // トークンリフレッシュを実行
    const refreshResult = await authService.refreshToken();
    assert.strictEqual(refreshResult, true, 'トークンリフレッシュに失敗しました');
    
    // 認証状態が維持されていること
    const state = authService.getCurrentState();
    assert.strictEqual(state.isAuthenticated, true, 'リフレッシュ後の認証状態が正しくありません');
  });
  
  // ユーザー情報取得テスト
  it('SimpleAuth ユーザー情報取得が成功すること', async function() {
    // このテストはAPIキーとパスワードが必要なため、CIでスキップさせる
    if (process.env.CI) {
      this.skip();
      return;
    }
    
    // まずログイン
    const loginResult = await authService.login(config.testUser.email, config.testUser.password);
    assert.strictEqual(loginResult, true, 'ログイン前提テストのログインに失敗しました');
    
    // ユーザー情報取得
    const userInfo = await authService.getUserInfo();
    assert.ok(userInfo, 'ユーザー情報が取得できませんでした');
    assert.ok(userInfo.id, 'ユーザーIDがありません');
    assert.ok(userInfo.name, 'ユーザー名がありません');
    assert.ok(userInfo.role, 'ユーザーロールがありません');
  });
  
  // ログアウトテスト
  it('SimpleAuth ログアウトが成功すること', async function() {
    // このテストはAPIキーとパスワードが必要なため、CIでスキップさせる
    if (process.env.CI) {
      this.skip();
      return;
    }
    
    // まずログイン
    const loginResult = await authService.login(config.testUser.email, config.testUser.password);
    assert.strictEqual(loginResult, true, 'ログイン前提テストのログインに失敗しました');
    
    // ログアウト実行
    await authService.logout();
    
    // 認証状態がリセットされているか確認
    const state = authService.getCurrentState();
    assert.strictEqual(state.isAuthenticated, false, 'ログアウト後も認証状態が維持されています');
    assert.strictEqual(state.role, Role.GUEST, 'ログアウト後もロールが維持されています');
  });
});