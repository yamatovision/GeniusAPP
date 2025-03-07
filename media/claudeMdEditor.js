(function() {
  // VSCode APIへのアクセス
  const vscode = acquireVsCodeApi();
  
  // DOM要素
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const saveBtn = document.getElementById('save-btn');
  const exportCliBtn = document.getElementById('export-cli-btn');
  const loadTemplateBtn = document.getElementById('load-template-btn');
  const filePathEl = document.getElementById('file-path');
  const sectionsList = document.getElementById('sections-list');
  const sectionEditor = document.getElementById('section-editor');
  const sectionEditorTitle = document.getElementById('section-editor-title');
  const sectionEditorContent = document.getElementById('section-editor-content');
  const updateSectionBtn = document.getElementById('update-section-btn');
  const cancelSectionBtn = document.getElementById('cancel-section-btn');
  const closeSectionEditorBtn = document.getElementById('close-section-editor');
  
  // 状態管理
  let currentContent = '';
  let currentPath = '';
  let currentSection = '';
  
  // 初期化
  document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
  });
  
  // イベントリスナーの初期化
  function initEventListeners() {
    // エディタの変更イベント
    editor.addEventListener('input', updatePreview);
    
    // 保存ボタン
    saveBtn.addEventListener('click', function() {
      vscode.postMessage({
        command: 'saveClaudeMd',
        content: editor.value
      });
    });
    
    // ClaudeCodeで開くボタン
    exportCliBtn.addEventListener('click', function() {
      vscode.postMessage({
        command: 'exportToCli'
      });
    });
    
    // テンプレート読み込み
    loadTemplateBtn.addEventListener('click', function() {
      if (editor.value && editor.value !== currentContent) {
        const confirmed = confirm('編集中の内容が失われますが、よろしいですか？');
        if (!confirmed) {
          return;
        }
      }
      
      vscode.postMessage({
        command: 'loadTemplate'
      });
    });
    
    // セクション選択
    sectionsList.addEventListener('click', function(event) {
      if (event.target.tagName === 'LI') {
        const sectionName = event.target.dataset.section;
        openSectionEditor(sectionName);
      }
    });
    
    // セクションエディタを閉じる
    closeSectionEditorBtn.addEventListener('click', closeSectionEditor);
    cancelSectionBtn.addEventListener('click', closeSectionEditor);
    
    // セクション更新
    updateSectionBtn.addEventListener('click', function() {
      if (!currentSection) return;
      
      vscode.postMessage({
        command: 'updateSection',
        sectionName: currentSection,
        content: sectionEditorContent.value
      });
      
      closeSectionEditor();
    });
  }
  
  // セクションエディタを開く
  function openSectionEditor(sectionName) {
    // セクションの内容を取得
    vscode.postMessage({
      command: 'getSection',
      sectionName: sectionName
    });
    
    currentSection = sectionName;
    sectionEditorTitle.textContent = `${sectionName}を編集`;
    sectionEditor.style.display = 'flex';
  }
  
  // セクションエディタを閉じる
  function closeSectionEditor() {
    sectionEditor.style.display = 'none';
    currentSection = '';
  }
  
  // プレビュー更新
  function updatePreview() {
    const markdownText = editor.value;
    
    // シンプルなMarkdownレンダリング
    let html = markdownText
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
      .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
      .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gm, '<em>$1</em>')
      .replace(/`([^`]+)`/gm, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/gm, function(match, p1) {
        return '<pre><code>' + p1.trim() + '</code></pre>';
      })
      .replace(/\n/gm, '<br>');
    
    preview.innerHTML = html;
  }
  
  // VSCodeからのメッセージ処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateContent':
        currentContent = message.content;
        currentPath = message.path;
        
        editor.value = currentContent;
        filePathEl.textContent = currentPath ? `ファイル: ${currentPath}` : '';
        
        updatePreview();
        break;
        
      case 'sectionContent':
        sectionEditorContent.value = message.content;
        break;
    }
  });
})();