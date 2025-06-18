import * as assert from 'assert';
import * as sinon from 'sinon';
import { ScopeManagerPanel } from '../../../src/ui/scopeManager/ScopeManagerPanel';
import { AuthGuard } from '../../../src/ui/auth/AuthGuard';
import { NoProjectViewPanel } from '../../../src/ui/noProjectView/NoProjectViewPanel';
import { Logger } from '../../../src/utils/logger';
import * as vscode from '../../mocks/vscode.mock';

// VSCodeモックをグローバルに設定
(global as any).vscode = vscode;

describe('NoProjectView Authentication Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let checkLoggedInStub: sinon.SinonStub;
  let noProjectViewCreateStub: sinon.SinonStub;
  let loggerInfoStub: sinon.SinonStub;

  before(() => {
    // Loggerの初期化
    Logger.initialize('test', 0, false);
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // AuthGuardのスタブ
    checkLoggedInStub = sandbox.stub(AuthGuard, 'checkLoggedIn');
    
    // NoProjectViewPanelのスタブ
    noProjectViewCreateStub = sandbox.stub(NoProjectViewPanel, 'createOrShow');
    
    // Loggerのスタブ
    loggerInfoStub = sandbox.stub(Logger, 'info');
    
    // ProjectServiceImplのモック
    const mockProjectService = {
      getAllProjects: () => [],
      getActiveProject: () => null
    };
    
    const mockFileSystemService = {};
    
    // requireのモック
    sandbox.stub(require.cache, '/src/ui/scopeManager/services/implementations/ProjectServiceImpl.js').value({
      exports: {
        ProjectServiceImpl: {
          getInstance: () => mockProjectService
        }
      }
    });
    
    sandbox.stub(require.cache, '/src/ui/scopeManager/services/implementations/FileSystemServiceImpl.js').value({
      exports: {
        FileSystemServiceImpl: {
          getInstance: () => mockFileSystemService
        }
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('ScopeManagerPanel.createOrShow', () => {
    it('should check login before showing NoProjectView when no projects exist', () => {
      // 準備
      checkLoggedInStub.returns(false); // 未ログイン
      const extensionUri = vscode.Uri.parse('file:///test');
      const context = {} as any;
      
      // 実行
      const result = ScopeManagerPanel.createOrShow(extensionUri, context);
      
      // 検証
      assert.strictEqual(result, undefined);
      assert(checkLoggedInStub.calledOnce, 'AuthGuard.checkLoggedIn should be called once');
      assert(noProjectViewCreateStub.notCalled, 'NoProjectViewPanel.createOrShow should not be called');
      assert(loggerInfoStub.calledWith('ScopeManagerPanel: NoProjectView表示前に未認証のためログインを促します'));
    });

    it('should show NoProjectView when logged in and no projects exist', () => {
      // 準備
      checkLoggedInStub.returns(true); // ログイン済み
      const extensionUri = vscode.Uri.parse('file:///test');
      const context = {} as any;
      
      // 実行
      const result = ScopeManagerPanel.createOrShow(extensionUri, context);
      
      // 検証
      assert.strictEqual(result, undefined);
      assert(checkLoggedInStub.calledOnce, 'AuthGuard.checkLoggedIn should be called once');
      assert(noProjectViewCreateStub.calledOnce, 'NoProjectViewPanel.createOrShow should be called once');
      assert(noProjectViewCreateStub.calledWith(extensionUri));
    });

    it('should not check login when projects exist', () => {
      // 準備
      const mockProjectService = {
        getAllProjects: () => [{ name: 'test-project', path: '/test/project' }],
        getActiveProject: () => ({ name: 'test-project', path: '/test/project' })
      };
      
      // ProjectServiceImplのモックを更新
      sandbox.stub(require.cache, '/src/ui/scopeManager/services/implementations/ProjectServiceImpl.js').value({
        exports: {
          ProjectServiceImpl: {
            getInstance: () => mockProjectService
          }
        }
      });
      
      const extensionUri = vscode.Uri.parse('file:///test');
      const context = {} as any;
      
      // 実行
      const result = ScopeManagerPanel.createOrShow(extensionUri, context);
      
      // 検証
      // プロジェクトが存在する場合はAuthGuardのチェックは呼ばれない（NoProjectViewに到達しないため）
      assert(checkLoggedInStub.notCalled, 'AuthGuard.checkLoggedIn should not be called when projects exist');
      assert(noProjectViewCreateStub.notCalled, 'NoProjectViewPanel.createOrShow should not be called when projects exist');
    });
  });
});