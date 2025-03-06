(function() {
  const vscode = acquireVsCodeApi();
  
  // 状態を保持
  let state = {
    requirementsDocument: '',
    items: [],
    selectedIds: [],
    estimatedTime: '--',
    mockupHtml: '',
    framework: 'react',
    requiredFiles: [],
    implementationPlan: ''
  };
  
  // DOM要素の参照
  let reqDocument, setRequirementsBtn, loadRequirementsBtn, extractItemsBtn,
      itemsSection, itemList, selectedCount, estimate, estimateBtn, completeBtn,
      mockupHtml, frameworkSelect, setMockupBtn, extractFilesBtn, fileList,
      generatePlanBtn, planContainer;
  
  // タブ関連の要素
  let tabButtons, tabContents;
  
  // ページの読み込み完了時に実行
  document.addEventListener('DOMContentLoaded', () => {
    // 要素への参照を取得
    reqDocument = document.getElementById('requirements-document');
    setRequirementsBtn = document.getElementById('set-requirements');
    loadRequirementsBtn = document.getElementById('load-requirements');
    extractItemsBtn = document.getElementById('extract-items');
    itemList = document.getElementById('item-list');
    selectedCount = document.getElementById('selected-count');
    estimate = document.getElementById('estimate');
    estimateBtn = document.getElementById('estimate-button');
    completeBtn = document.getElementById('complete-selection');
    mockupHtml = document.getElementById('mockup-html');
    frameworkSelect = document.getElementById('framework-select');
    setMockupBtn = document.getElementById('set-mockup');
    extractFilesBtn = document.getElementById('extract-files');
    fileList = document.getElementById('file-list');
    generatePlanBtn = document.getElementById('generate-plan');
    planContainer = document.getElementById('plan-container');
    
    // タブ関連の要素
    tabButtons = [
      document.getElementById('tab-requirements'),
      document.getElementById('tab-items'),
      document.getElementById('tab-mockup'),
      document.getElementById('tab-plan')
    ];
    
    tabContents = [
      document.getElementById('tab-content-requirements'),
      document.getElementById('tab-content-items'),
      document.getElementById('tab-content-mockup'),
      document.getElementById('tab-content-plan')
    ];
    
    // イベントリスナーの登録
    // タブ切り替え
    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        switchTab(index);
      });
    });
    
    // 要件定義
    setRequirementsBtn.addEventListener('click', () => {
      const text = reqDocument.value.trim();
      if (!text) {
        showError('要件定義書を入力してください');
        return;
      }
      
      vscode.postMessage({
        command: 'setRequirementsDocument',
        text
      });
    });
    
    loadRequirementsBtn.addEventListener('click', () => {
      vscode.postMessage({
        command: 'loadRequirementsFromFile'
      });
    });
    
    extractItemsBtn.addEventListener('click', () => {
      if (!state.requirementsDocument) {
        showError('要件定義書を設定してください');
        return;
      }
      
      vscode.postMessage({
        command: 'extractItems'
      });
    });
    
    // 見積もり計算
    estimateBtn.addEventListener('click', () => {
      if (state.selectedIds.length === 0) {
        showError('少なくとも1つの項目を選択してください');
        return;
      }
      
      vscode.postMessage({
        command: 'estimateScope'
      });
    });
    
    // スコープ選択完了
    completeBtn.addEventListener('click', () => {
      if (state.selectedIds.length === 0) {
        showError('少なくとも1つの項目を選択してください');
        return;
      }
      
      vscode.postMessage({
        command: 'completeSelection'
      });
    });
    
    // モックアップ設定
    setMockupBtn.addEventListener('click', () => {
      const html = mockupHtml.value.trim();
      if (!html) {
        showError('モックアップHTMLを入力してください');
        return;
      }
      
      vscode.postMessage({
        command: 'setMockupHtml',
        html,
        framework: frameworkSelect.value
      });
    });
    
    // ファイル一覧抽出
    extractFilesBtn.addEventListener('click', () => {
      if (!state.mockupHtml) {
        showError('モックアップHTMLを設定してください');
        return;
      }
      
      vscode.postMessage({
        command: 'extractRequiredFiles'
      });
    });
    
    // 実装計画生成
    generatePlanBtn.addEventListener('click', () => {
      if (state.selectedIds.length === 0) {
        showError('少なくとも1つの項目を選択してください');
        return;
      }
      
      vscode.postMessage({
        command: 'generateImplementationPlan'
      });
    });
  });
  
  // タブを切り替える
  function switchTab(index) {
    tabButtons.forEach(button => button.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    tabButtons[index].classList.add('active');
    tabContents[index].classList.add('active');
  }
  
  // アイテムリストのレンダリング
  function renderItemList() {
    if (!itemList) return;
    
    itemList.innerHTML = '';
    
    if (state.items.length === 0) {
      itemList.innerHTML = '<div style="padding: 15px;">実装項目はまだ抽出されていません</div>';
      return;
    }
    
    state.items.forEach(item => {
      const itemCard = document.createElement('div');
      itemCard.className = 'item-card' + (item.isSelected ? ' selected' : '');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'item-checkbox';
      checkbox.checked = item.isSelected;
      checkbox.addEventListener('change', () => {
        vscode.postMessage({
          command: 'toggleItem',
          id: item.id
        });
      });
      
      const content = document.createElement('div');
      content.className = 'item-content';
      
      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = `${item.id}: ${item.title}`;
      
      const description = document.createElement('div');
      description.className = 'item-description';
      description.textContent = item.description;
      
      const metadata = document.createElement('div');
      metadata.className = 'item-metadata';
      
      const priority = document.createElement('div');
      priority.className = `item-priority priority-${item.priority}`;
      priority.textContent = `優先度: ${getPriorityText(item.priority)}`;
      
      const complexity = document.createElement('div');
      complexity.className = `item-complexity priority-${item.complexity}`;
      complexity.textContent = `複雑度: ${getComplexityText(item.complexity)}`;
      
      metadata.appendChild(priority);
      metadata.appendChild(complexity);
      
      // 依存関係がある場合は表示
      if (item.dependencies && item.dependencies.length > 0) {
        const dependencies = document.createElement('div');
        dependencies.className = 'item-dependencies';
        dependencies.textContent = `依存: ${item.dependencies.join(', ')}`;
        metadata.appendChild(dependencies);
      }
      
      content.appendChild(title);
      content.appendChild(description);
      content.appendChild(metadata);
      
      itemCard.appendChild(checkbox);
      itemCard.appendChild(content);
      itemList.appendChild(itemCard);
    });
    
    // 選択数の更新
    if (selectedCount) {
      selectedCount.textContent = `選択済み: ${state.selectedIds.length} / ${state.items.length} 項目`;
    }
    
    // 推定工数の更新
    if (estimate) {
      estimate.textContent = `推定工数: ${state.estimatedTime}`;
    }
  }
  
  // ファイル一覧の更新
  function updateFileList(files) {
    if (!fileList) return;
    
    fileList.innerHTML = '';
    
    if (!files || files.length === 0) {
      fileList.innerHTML = '<div class="file-item">ファイルはまだ抽出されていません</div>';
      return;
    }
    
    files.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.textContent = file;
      fileList.appendChild(fileItem);
    });
  }
  
  // 実装計画の更新
  function updateImplementationPlan(plan) {
    if (!planContainer) return;
    
    if (!plan) {
      planContainer.innerHTML = '<p>実装計画はまだ生成されていません</p>';
      return;
    }
    
    // Markdownをシンプルに変換
    const formattedPlan = plan
      .replace(/## (.*)/g, '<h3>$1</h3>')
      .replace(/# (.*)/g, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    
    planContainer.innerHTML = formattedPlan;
  }
  
  // 優先度の表示テキストを取得
  function getPriorityText(priority) {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  }
  
  // 複雑度の表示テキストを取得
  function getComplexityText(complexity) {
    switch (complexity) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return complexity;
    }
  }
  
  // エラーメッセージ表示
  function showError(message) {
    // 既存のエラー表示があれば削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // エラーメッセージ表示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // 現在アクティブなタブコンテンツに追加
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
      activeTab.insertBefore(errorDiv, activeTab.firstChild);
      
      // 数秒後に消す
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.remove();
        }
      }, 5000);
    }
    
    console.error(message);
  }
  
  // VSCodeからのメッセージを処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        // 状態更新
        if (message.requirementsDocument !== undefined) {
          state.requirementsDocument = message.requirementsDocument;
          if (reqDocument) reqDocument.value = message.requirementsDocument;
        }
        
        if (message.items !== undefined) {
          state.items = message.items;
        }
        
        if (message.selectedIds !== undefined) {
          state.selectedIds = message.selectedIds;
        }
        
        if (message.estimatedTime !== undefined) {
          state.estimatedTime = message.estimatedTime;
          if (estimate) estimate.textContent = `推定工数: ${message.estimatedTime}`;
        }
        
        if (message.mockupHtml !== undefined) {
          state.mockupHtml = message.mockupHtml;
          if (mockupHtml) mockupHtml.value = message.mockupHtml;
        }
        
        if (message.framework !== undefined) {
          state.framework = message.framework;
          if (frameworkSelect) frameworkSelect.value = message.framework;
        }
        
        // UIの更新
        renderItemList();
        break;
        
      case 'startExtraction':
        // 抽出処理の開始
        const loadingElement = document.getElementById('requirements-loading');
        if (loadingElement) {
          loadingElement.style.display = 'flex';
        }
        const progressBar = document.getElementById('requirements-progress');
        if (progressBar) {
          progressBar.style.width = '0%';
        }
        break;
        
      case 'updateExtractionProgress':
        // 抽出進捗の更新
        const progress = message.progress || 0;
        const progressElement = document.getElementById('requirements-progress');
        if (progressElement) {
          progressElement.style.width = `${progress}%`;
        }
        break;
        
      case 'completeExtraction':
        // 抽出処理の完了
        const completeLoadingElement = document.getElementById('requirements-loading');
        if (completeLoadingElement) {
          setTimeout(() => {
            completeLoadingElement.style.display = 'none';
          }, 1000); // 少し待ってから非表示に
        }
        break;
        
      case 'switchToItemsTab':
        // 実装項目タブに切り替え
        switchTab(1);
        break;
        
      case 'updateEstimate':
        state.estimatedTime = message.estimatedTime;
        if (estimate) estimate.textContent = `推定工数: ${message.estimatedTime}`;
        break;
        
      case 'updateRequiredFiles':
        state.requiredFiles = message.files;
        updateFileList(message.files);
        break;
        
      case 'updateImplementationPlan':
        state.implementationPlan = message.plan;
        updateImplementationPlan(message.plan);
        break;
        
      case 'showError':
        showError(message.message);
        break;
    }
  });
  
  // 初期化メッセージを送信
  vscode.postMessage({
    command: 'initialize'
  });
})();