// AI検索機能のシミュレーションテスト
const fs = require('fs');
const path = require('path');

// モックロガー
const Logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  error: (msg, err) => console.log(`[ERROR] ${msg}`, err || '')
};

// テスト用のディレクトリ構造文字列
const testCurrentDirectory = `
プロジェクトディレクトリ構造:
/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius

言語別ファイル数:
- TypeScript: 68
- JavaScript: 42
- HTML: 15
- CSS: 10
- その他: 23
`;

// AI検索シミュレーター
class AISearchSimulator {
  constructor(dirStructure) {
    this.currentDirectory = dirStructure;
    this.rootPath = this.extractProjectPath();
    this.results = [];
  }
  
  // プロジェクトパスの抽出
  extractProjectPath() {
    if (this.currentDirectory && this.currentDirectory.includes('プロジェクトディレクトリ構造:')) {
      const pathMatch = this.currentDirectory.match(/プロジェクトディレクトリ構造:[\s\n]*([^\s\n]+)/);
      if (pathMatch && pathMatch[1]) {
        const extractedPath = pathMatch[1].trim();
        if (fs.existsSync(extractedPath)) {
          Logger.info(`ディレクトリ構造情報から抽出したパス: ${extractedPath}`);
          return extractedPath;
        } else {
          Logger.error(`抽出されたパスが存在しません: ${extractedPath}`);
        }
      }
    }
    Logger.error('プロジェクトパスの抽出に失敗しました');
    return process.cwd(); // フォールバックとして現在の作業ディレクトリを使用
  }
  
  // ファイル検索シミュレーション 
  async searchFiles(pattern, isContentSearch = false) {
    this.results = [];
    Logger.info(`ファイル${isContentSearch ? '内容' : '名'}検索: ${pattern}`);
    
    const searchDirectory = async (dir, pattern, isContentSearch) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // node_modules などは除外
          if (fullPath.includes('node_modules') || 
              fullPath.includes('.git') || 
              fullPath.includes('dist')) {
            continue;
          }
          
          if (entry.isDirectory()) {
            await searchDirectory(fullPath, pattern, isContentSearch);
          } else if (entry.isFile()) {
            const fileExt = path.extname(entry.name).toLowerCase();
            const textExtensions = ['.ts', '.js', '.json', '.md', '.txt', '.html', '.css'];
            
            if (textExtensions.includes(fileExt)) {
              if (isContentSearch) {
                // 内容検索
                try {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  if (content.includes(pattern)) {
                    this.results.push({
                      filePath: fullPath,
                      relativePath: path.relative(this.rootPath, fullPath),
                      matched: true,
                      matchType: 'content'
                    });
                  }
                } catch (err) {
                  Logger.error(`ファイル読み込みエラー: ${fullPath}`, err);
                }
              } else {
                // ファイル名検索
                if (entry.name.includes(pattern)) {
                  this.results.push({
                    filePath: fullPath,
                    relativePath: path.relative(this.rootPath, fullPath),
                    matched: true,
                    matchType: 'filename'
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        Logger.error(`ディレクトリ読み込みエラー: ${dir}`, err);
      }
    };
    
    await searchDirectory(this.rootPath, pattern, isContentSearch);
    return this.results;
  }
  
  // ファイル内容を読み込み
  readFile(filePath) {
    try {
      // 相対パスの場合はプロジェクトルートからの相対パスとして扱う
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.rootPath, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      return {
        filePath: fullPath,
        relativePath: path.relative(this.rootPath, fullPath),
        content: content,
        success: true
      };
    } catch (err) {
      Logger.error(`ファイル読み込みエラー: ${filePath}`, err);
      return {
        filePath,
        success: false,
        error: err.message
      };
    }
  }
  
  // 検索結果のサマリーを表示
  displayResults() {
    console.log('\n=== 検索結果 ===');
    console.log(`合計: ${this.results.length}件の一致`);
    
    const maxDisplay = 5; // 表示件数を制限
    const displayResults = this.results.slice(0, maxDisplay);
    
    displayResults.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.relativePath}`);
      console.log(`  タイプ: ${result.matchType === 'content' ? 'ファイル内容に一致' : 'ファイル名に一致'}`);
      
      // ファイル内容のサンプルを表示
      if (result.matchType === 'content') {
        const fileData = this.readFile(result.filePath);
        if (fileData.success) {
          const contentPreview = fileData.content.substring(0, 150) + '...';
          console.log(`  内容サンプル: ${contentPreview.replace(/\n/g, ' ')}`);
        }
      }
    });
    
    if (this.results.length > maxDisplay) {
      console.log(`\n... 他に${this.results.length - maxDisplay}件の結果があります`);
    }
  }
}

// テスト実行
async function runAISearchTests() {
  console.log('=== AI検索シミュレーションテスト開始 ===');
  
  const searchSim = new AISearchSimulator(testCurrentDirectory);
  
  // テスト1: ファイル名検索
  console.log('\n--- テスト1: ファイル名検索 (logger) ---');
  const fileResults = await searchSim.searchFiles('logger');
  searchSim.displayResults();
  
  // テスト2: ファイル内容検索
  console.log('\n--- テスト2: ファイル内容検索 (authentication) ---');
  const contentResults = await searchSim.searchFiles('authentication', true);
  searchSim.displayResults();
  
  // テスト3: 特定ファイルの読み込み
  console.log('\n--- テスト3: 特定ファイルの読み込み ---');
  if (fileResults.length > 0) {
    const targetFile = fileResults[0].relativePath;
    console.log(`読み込みファイル: ${targetFile}`);
    const fileData = searchSim.readFile(targetFile);
    if (fileData.success) {
      console.log(`ファイル内容(先頭300文字):\n${fileData.content.substring(0, 300)}...`);
    }
  } else {
    console.log('テスト対象ファイルが見つかりませんでした');
  }
  
  console.log('\n=== AI検索シミュレーションテスト終了 ===');
}

// テスト実行
runAISearchTests();