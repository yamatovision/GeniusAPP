/**
 * プロジェクト登録解除処理
 * 
 * ScopeManagerPanel.tsファイルに追加すべきメソッド
 * 
 * 1. まず、以下のcase文をswitch文に追加
 * (window.addEventListener('message', async message => { の中のswitch (message.command) { ... }内)
 * 
 * ```typescript
 * case 'removeProject':
 *   await this._handleRemoveProject(message.projectName, message.projectPath, message.projectId);
 *   break;
 * ```
 * 
 * 2. 次に、クラスの最後（終わりの括弧の直前）に次のメソッドを追加
 */

/**
 * プロジェクト登録解除処理
 */
private async _handleRemoveProject(projectName: string, projectPath: string, projectId?: string): Promise<void> {
  try {
    Logger.info(`プロジェクト登録解除: ${projectName}, パス: ${projectPath}, ID: ${projectId || 'なし'}`);
    
    if (!projectName && !projectPath && !projectId) {
      this._showError('プロジェクト情報が不足しています');
      return;
    }
    
    // ProjectManagementServiceを使用してプロジェクトを登録解除
    try {
      const { ProjectManagementService } = require('../../services/ProjectManagementService');
      const projectService = ProjectManagementService.getInstance();
      
      // IDが指定されている場合はそれを使用、なければパスで検索
      let removed = false;
      
      if (projectId) {
        removed = await projectService.removeProjectById(projectId);
      } else {
        removed = await projectService.removeProjectByPath(projectPath);
      }
      
      if (removed) {
        Logger.info(`プロジェクト「${projectName}」の登録解除に成功しました`);
        
        // プロジェクト一覧を更新
        this._currentProjects = projectService.getAllProjects();
        this._activeProject = projectService.getActiveProject();
        
        // WebViewにプロジェクト一覧と現在のプロジェクトを送信
        this._panel.webview.postMessage({
          command: 'updateProjects',
          projects: this._currentProjects,
          activeProject: this._activeProject
        });
        
        // 現在のプロジェクトが削除されたプロジェクトと同じ場合、別のプロジェクトへ切り替え
        if (this._projectPath === projectPath) {
          if (this._activeProject && this._activeProject.path) {
            await this.setProjectPath(this._activeProject.path);
          } else if (this._currentProjects.length > 0) {
            await this.setProjectPath(this._currentProjects[0].path);
          }
        }
        
        this._showSuccess(`プロジェクト「${projectName}」の登録を解除しました`);
      } else {
        this._showError(`プロジェクト「${projectName}」の登録解除に失敗しました`);
      }
    } catch (error) {
      Logger.error('プロジェクト登録解除エラー', error as Error);
      this._showError(`プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
    }
  } catch (error) {
    Logger.error('プロジェクト登録解除処理エラー', error as Error);
    this._showError(`プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
  }
}