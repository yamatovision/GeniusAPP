// @ts-check
import stateManager from '../core/stateManager.js';
import tabManager from '../components/tabManager/tabManager.js';
import markdownViewer from '../components/markdownViewer/markdownViewer.js';
import projectNavigation from '../components/projectNavigation/projectNavigation.js';
import dialogManager from '../components/dialogManager/dialogManager.js';

class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this.setupHandlers();
    this.setupMessageListener();
  }

  setupHandlers() {
    // メッセージハンドラを登録
    this.registerHandler('updateState', this.handleUpdateState.bind(this));
    this.registerHandler('showError', this.handleShowError.bind(this));
    this.registerHandler('showSuccess', this.handleShowSuccess.bind(this));
    this.registerHandler('updateMarkdownContent', this.handleUpdateMarkdownContent.bind(this));
    this.registerHandler('updateProjects', this.handleUpdateProjects.bind(this));
    this.registerHandler('selectTab', this.handleSelectTab.bind(this));
    this.registerHandler('syncProjectState', this.handleSyncProjectState.bind(this));
    // その他のハンドラ登録
  }

  registerHandler(command, handler) {
    this.handlers.set(command, handler);
  }

  setupMessageListener() {
    window.addEventListener('message', event => {
      const message = event.data;
      this.handleMessage(message);
    });
  }

  handleMessage(message) {
    console.log('Received message:', message.command);
    
    const handler = this.handlers.get(message.command);
    if (handler) {
      handler(message);
    } else {
      console.warn('No handler registered for command:', message.command);
    }
  }

  // 各種ハンドラメソッド
  handleUpdateState(message) {
    stateManager.setState(message);
  }

  handleShowError(message) {
    dialogManager.showError(message.message);
  }

  handleShowSuccess(message) {
    dialogManager.showSuccess(message.message);
  }

  handleUpdateMarkdownContent(message) {
    markdownViewer.updateContent(message.content);
  }

  handleUpdateProjects(message) {
    projectNavigation.updateProjects(message.projects, message.activeProject);
  }

  handleSelectTab(message) {
    tabManager.selectTab(message.tabId, false);
  }

  handleSyncProjectState(message) {
    if (!message.project) return;
    
    const project = message.project;
    stateManager.setState({
      activeProject: project,
      activeTab: project.metadata?.activeTab || stateManager.getState().activeTab
    });
    
    // プロジェクト情報更新
    projectNavigation.updateActiveProject(project);
    
    // タブ状態更新
    if (project.metadata?.activeTab) {
      tabManager.selectTab(project.metadata.activeTab, false);
    }
  }
}

// 初期化
const messageHandler = new MessageHandler();
export default messageHandler;