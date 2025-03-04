import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from '../../core/aiService';
import { FileManager } from '../../utils/fileManager';
import { Logger } from '../../utils/logger';
import { ProjectAnalyzer } from '../../core/projectAnalyzer';

export interface TestGenerationOptions {
  sourcePath: string;
  testFramework?: 'jest' | 'mocha' | 'vitest' | 'jasmine' | 'ava' | 'tape' | 'pytest' | 'junit' | 'testng' | 'xunit' | 'nunit' | 'auto';
  coverage?: 'unit' | 'integration' | 'e2e' | 'full';
  customOutputPath?: string;
  additionalContext?: string;
}

export interface GeneratedTest {
  path: string;
  content: string;
  sourceFile: string;
  framework: string;
  coverage: string;
}

export class TestGenerator {
  private aiService: AIService;
  private projectAnalyzer: ProjectAnalyzer;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.projectAnalyzer = new ProjectAnalyzer();
  }

  /**
   * ソースコードからテストを生成する
   * @param options テスト生成オプション
   */
  public async generateTests(options: TestGenerationOptions): Promise<GeneratedTest> {
    try {
      Logger.info(`テスト生成を開始: ${options.sourcePath}`);

      // ソースファイルが存在するか確認
      if (!await FileManager.fileExists(options.sourcePath)) {
        throw new Error(`ソースファイル ${options.sourcePath} が見つかりません`);
      }

      // ソースファイル内容を読み込む
      const sourceContent = await FileManager.readFile(options.sourcePath);
      if (!sourceContent.trim()) {
        throw new Error(`ソースファイル ${options.sourcePath} は空です`);
      }

      // プロジェクト構造を分析してコンテキストを強化
      const projectDir = path.dirname(options.sourcePath);
      const projectContext = await this.getProjectContext(projectDir);
      
      // テストフレームワークを検出
      const testFramework = options.testFramework === 'auto' || !options.testFramework
        ? await this.detectTestFramework(projectContext, options.sourcePath)
        : options.testFramework;
      
      // テスト出力パスを決定
      const testPath = await this.determineTestPath(options.sourcePath, testFramework, options.customOutputPath);
      
      // AIサービスにプロンプトを送信
      const prompt = this.buildTestGenerationPrompt(options, sourceContent, projectContext, testFramework);
      const aiResponse = await this.aiService.sendMessage(prompt, 'implementation');
      
      // テストコードを抽出
      const testContent = this.extractTestCode(aiResponse);
      
      // テストファイルを保存
      const testDir = path.dirname(testPath);
      if (!await FileManager.directoryExists(testDir)) {
        await FileManager.createDirectory(testDir);
      }
      
      await FileManager.writeFile(testPath, testContent);
      
      // 生成結果を返す
      return {
        path: testPath,
        content: testContent,
        sourceFile: options.sourcePath,
        framework: testFramework,
        coverage: options.coverage || 'unit'
      };
    } catch (error) {
      Logger.error('テスト生成中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * プロジェクトで使用されているテストフレームワークを検出する
   */
  private async detectTestFramework(projectContext: any, sourcePath: string): Promise<string> {
    try {
      // package.jsonを検索
      const packageJsonPaths = await this.findFileInProject('package.json', projectContext.root.path);
      
      if (packageJsonPaths.length > 0) {
        // 最も近いpackage.jsonを使用
        const packageJsonContent = await FileManager.readFile(packageJsonPaths[0]);
        const packageJson = JSON.parse(packageJsonContent);
        
        // 依存関係からテストフレームワークを検出
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
        
        if (dependencies.jest) {
          return 'jest';
        } else if (dependencies.mocha) {
          return 'mocha';
        } else if (dependencies.vitest) {
          return 'vitest';
        } else if (dependencies.jasmine) {
          return 'jasmine';
        } else if (dependencies.ava) {
          return 'ava';
        } else if (dependencies.tape) {
          return 'tape';
        }
      }
      
      // Python用のテストフレームワーク検出
      if (projectContext.root.path.includes('requirements.txt') || 
          projectContext.root.path.includes('pyproject.toml')) {
        return 'pytest';
      }
      
      // Javaプロジェクトの検出
      const pomFiles = await this.findFileInProject('pom.xml', projectContext.root.path);
      if (pomFiles.length > 0) {
        return 'junit';
      }
      
      // C#プロジェクトの検出
      const csprojFiles = await this.findFileInProject('.csproj', projectContext.root.path);
      if (csprojFiles.length > 0) {
        return 'xunit';
      }
      
      // ファイル拡張子からのフォールバック
      const ext = path.extname(sourcePath).toLowerCase();
      switch (ext) {
        case '.ts':
        case '.tsx':
        case '.js':
        case '.jsx':
          return 'jest';
        case '.py':
          return 'pytest';
        case '.java':
          return 'junit';
        case '.cs':
          return 'xunit';
        case '.go':
          return 'testing';
        case '.rb':
          return 'rspec';
        default:
          return 'jest';
      }
    } catch (error) {
      Logger.error('テストフレームワーク検出に失敗しました', error as Error);
      return 'jest'; // デフォルトのフレームワーク
    }
  }

  /**
   * プロジェクト内のファイルを検索する
   */
  private async findFileInProject(pattern: string, rootPath: string): Promise<string[]> {
    try {
      // 簡易実装 - 本番では再帰的に検索するロジックが必要
      const files: string[] = [];
      const entries = await FileManager.listDirectory(rootPath);
      
      for (const entry of entries) {
        const entryPath = path.join(rootPath, entry);
        
        if (await FileManager.directoryExists(entryPath)) {
          const subEntries = await this.findFileInProject(pattern, entryPath);
          files.push(...subEntries);
        } else if (entry.includes(pattern)) {
          files.push(entryPath);
        }
      }
      
      return files;
    } catch (error) {
      Logger.info(`ファイル検索中にエラーが発生しました: ${error}`);
      return [];
    }
  }

  /**
   * テストファイルの出力パスを決定する
   */
  private async determineTestPath(
    sourcePath: string, 
    framework: string, 
    customPath?: string
  ): Promise<string> {
    if (customPath) {
      return customPath;
    }
    
    const sourceExt = path.extname(sourcePath);
    const sourceBasename = path.basename(sourcePath, sourceExt);
    const sourceDir = path.dirname(sourcePath);
    
    // フレームワークに応じたテストファイル命名規則とディレクトリ構造
    switch (framework) {
      case 'jest':
      case 'vitest':
        // Jest/Vitestの命名規則: component.test.js または __tests__/component.test.js
        const jestTestsDir = path.join(sourceDir, '__tests__');
        if (await FileManager.directoryExists(jestTestsDir)) {
          return path.join(jestTestsDir, `${sourceBasename}.test${sourceExt}`);
        }
        return path.join(sourceDir, `${sourceBasename}.test${sourceExt}`);
        
      case 'mocha':
      case 'jasmine':
        // Mocha/Jasmineの命名規則: test/component.js
        const mochaTestDir = path.resolve(sourceDir, '..', 'test');
        if (await FileManager.directoryExists(mochaTestDir)) {
          return path.join(mochaTestDir, `${sourceBasename}${sourceExt}`);
        }
        return path.join(sourceDir, `${sourceBasename}.spec${sourceExt}`);
        
      case 'pytest':
        // Pytestの命名規則: test_module.py
        return path.join(sourceDir, `test_${sourceBasename}${sourceExt}`);
        
      case 'junit':
      case 'testng':
        // JUnitの命名規則: src/test/java/package/ClassTest.java
        if (sourcePath.includes('src/main/java')) {
          const testPath = sourcePath.replace('src/main/java', 'src/test/java');
          return testPath.replace(`.java`, `Test.java`);
        }
        return path.join(sourceDir, `${sourceBasename}Test${sourceExt}`);
        
      case 'xunit':
      case 'nunit':
        // xUnitの命名規則: Tests/ClassTests.cs
        if (sourcePath.includes('/src/')) {
          const testPath = sourcePath.replace('/src/', '/Tests/');
          return testPath.replace(`.cs`, `Tests.cs`);
        }
        return path.join(sourceDir, `${sourceBasename}Tests${sourceExt}`);
        
      default:
        // デフォルトの命名規則
        return path.join(sourceDir, `${sourceBasename}.test${sourceExt}`);
    }
  }

  /**
   * プロジェクトのコンテキスト情報を取得
   */
  private async getProjectContext(projectDir: string): Promise<any> {
    try {
      // プロジェクト構造を分析
      const analysis = await this.projectAnalyzer.analyzeProject(projectDir);
      
      // 既存のテストファイルを検索してコンテキストを強化
      const testFrameworks = await this.scanForTestFrameworks(projectDir);
      const existingTests = await this.scanForExistingTests(projectDir);
      
      return {
        ...analysis,
        testFrameworks,
        existingTests
      };
    } catch (error) {
      Logger.error('プロジェクトコンテキスト取得でエラーが発生しました', error as Error);
      // 最小限の構造を返す
      return {
        root: {
          name: path.basename(projectDir),
          path: projectDir,
          type: 'directory',
          children: []
        },
        testFrameworks: [],
        existingTests: []
      };
    }
  }

  /**
   * プロジェクト内のテストフレームワーク関連ファイルをスキャンする
   */
  private async scanForTestFrameworks(projectDir: string): Promise<string[]> {
    try {
      const frameworks: string[] = [];
      
      // package.jsonを検索
      const packageJsonPaths = await this.findFileInProject('package.json', projectDir);
      
      if (packageJsonPaths.length > 0) {
        const packageJsonContent = await FileManager.readFile(packageJsonPaths[0]);
        const packageJson = JSON.parse(packageJsonContent);
        
        const dependencies = {
          ...packageJson.dependencies || {},
          ...packageJson.devDependencies || {}
        };
        
        // テストフレームワークを検出
        if (dependencies.jest) frameworks.push('jest');
        if (dependencies.mocha) frameworks.push('mocha');
        if (dependencies.vitest) frameworks.push('vitest');
        if (dependencies.jasmine) frameworks.push('jasmine');
        if (dependencies.ava) frameworks.push('ava');
        if (dependencies.tape) frameworks.push('tape');
      }
      
      // 設定ファイルを検索
      const configFiles = [
        { name: 'jest.config.js', framework: 'jest' },
        { name: 'vitest.config.js', framework: 'vitest' },
        { name: '.mocharc.js', framework: 'mocha' },
        { name: 'jasmine.json', framework: 'jasmine' },
        { name: 'pytest.ini', framework: 'pytest' },
        { name: 'conftest.py', framework: 'pytest' }
      ];
      
      for (const config of configFiles) {
        const found = await this.findFileInProject(config.name, projectDir);
        if (found.length > 0 && !frameworks.includes(config.framework)) {
          frameworks.push(config.framework);
        }
      }
      
      return frameworks;
    } catch (error) {
      Logger.error('テストフレームワークスキャン中にエラーが発生しました', error as Error);
      return [];
    }
  }

  /**
   * プロジェクト内の既存テストファイルをスキャンする
   */
  private async scanForExistingTests(projectDir: string): Promise<string[]> {
    try {
      // テストファイルのパターン
      const patterns = [
        '.test.ts', '.test.js', '.test.tsx', '.test.jsx',
        '.spec.ts', '.spec.js', '.spec.tsx', '.spec.jsx',
        'test_', '_test.py',
        'Test.java', 'Tests.cs'
      ];
      
      const testFiles: string[] = [];
      
      for (const pattern of patterns) {
        const found = await this.findFileInProject(pattern, projectDir);
        testFiles.push(...found);
      }
      
      return testFiles;
    } catch (error) {
      Logger.error('既存テストファイルスキャン中にエラーが発生しました', error as Error);
      return [];
    }
  }

  /**
   * AIレスポンスからテストコードを抽出
   */
  private extractTestCode(aiResponse: string): string {
    // コードブロックのパターン
    const codeBlockPattern = /```(?:\w+)?\s*\n([\s\S]*?)```/g;
    
    let testCode = '';
    let match;
    
    // すべてのコードブロックを抽出
    while ((match = codeBlockPattern.exec(aiResponse)) !== null) {
      testCode += match[1] + '\n\n';
    }
    
    // コードブロックが見つからない場合は全体を返す
    if (!testCode) {
      testCode = aiResponse;
    }
    
    return testCode.trim();
  }

  /**
   * テスト生成のプロンプトを構築
   */
  private buildTestGenerationPrompt(
    options: TestGenerationOptions,
    sourceContent: string,
    projectContext: any,
    testFramework: string
  ): string {
    const sourcePath = options.sourcePath;
    const fileName = path.basename(sourcePath);
    const fileExt = path.extname(sourcePath);
    const language = this.getLanguageFromExtension(fileExt);
    const coverage = options.coverage || 'unit';

    // フレームワーク固有の情報
    const frameworkInfo = this.getTestFrameworkInfo(testFramework, language);
    
    // プロンプトを構築
    let prompt = `あなたはAppGenius AIのテスト生成エンジンです。
次のソースコードに対するテストを生成してください：${fileName}

ソースコード:
\`\`\`${language}
${sourceContent}
\`\`\`

テスト設定:
- テストフレームワーク: ${testFramework}
- カバレッジレベル: ${coverage}
- プログラミング言語: ${language}
- テスト種別: ${coverage === 'unit' ? '単体テスト' : coverage === 'integration' ? '統合テスト' : 'E2Eテスト'}

${frameworkInfo.description}

既存のプロジェクト構造:
${JSON.stringify(projectContext.structure || {}, null, 2)}

テスト生成ガイドライン:
1. ${testFramework}の標準的なテスト構造に従ってください
2. 適切なテスト分類とグループ化を行ってください
3. 各テストケースはソースコードの特定の機能や関数に対応させてください
4. エッジケース、異常系、境界値のテストを含めてください
5. モック、スタブ、スパイが必要な場合は、適切に実装してください
6. コードカバレッジを最大化するようにテストを設計してください
7. テストコードには適切なコメントを含めてください
${frameworkInfo.guidelines.join('\n')}

${options.additionalContext ? `追加コンテキスト:\n${options.additionalContext}\n` : ''}

出力形式：
- テストコードのみをコードブロック内に含めてください
- 説明や解説は不要です
`;

    return prompt;
  }

  /**
   * テストフレームワーク固有の情報を取得
   */
  private getTestFrameworkInfo(framework: string, _language: string): { description: string, guidelines: string[] } {
    switch (framework) {
      case 'jest':
        return {
          description: 'Jestはシンプルで強力なJavaScript/TypeScriptテストフレームワークです。',
          guidelines: [
            'describe/it構文を使用してテストをグループ化してください',
            'expectとtoBeなどのマッチャーを使用して検証してください',
            'beforeEach/afterEachでテストの前後処理を定義してください',
            'jest.mockを使用して依存関係をモックしてください',
            'スナップショットテストは必要に応じて使用してください'
          ]
        };
        
      case 'mocha':
        return {
          description: 'Mochaは柔軟なJavaScript/TypeScriptテストフレームワークです。',
          guidelines: [
            'describe/it構文を使用してテストをグループ化してください',
            'assertライブラリ（chai等）を使用して検証してください',
            'before/after/beforeEach/afterEachでテストの前後処理を定義してください',
            'sinon等を使用してスタブ・モック・スパイを作成してください'
          ]
        };
        
      case 'vitest':
        return {
          description: 'Vitestは高速なVue/TypeScript向けのテストフレームワークです。',
          guidelines: [
            'Jest互換のAPIを使用してテストを記述してください',
            'describe/it構文とexpectマッチャーを使用してください',
            'viteの設定を考慮してインポートパスを使用してください',
            'コンポーネントテストではvue-test-utilsを使用してください'
          ]
        };
        
      case 'pytest':
        return {
          description: 'Pytestは柔軟で生産的なPythonテストフレームワークです。',
          guidelines: [
            'test_プレフィックスでテスト関数を定義してください',
            'assertステートメントを使用して検証してください',
            'フィクスチャを使用してテスト間で状態を共有してください',
            'パラメータ化テストを使用して入力バリエーションをテストしてください',
            'モックには@patch装飾子を使用してください'
          ]
        };
        
      case 'junit':
        return {
          description: 'JUnitはJava向けの標準的なテストフレームワークです。',
          guidelines: [
            '@Testアノテーションでテストメソッドを定義してください',
            'assertメソッドを使用して検証してください',
            '@Before/@Afterアノテーションを使用してテストの前後処理を定義してください',
            'Mockitoを使用してモックを作成してください',
            '@Parametrizedを使用してパラメータ化テストを作成してください'
          ]
        };
        
      case 'xunit':
        return {
          description: 'xUnitはC#/.NET向けのテストフレームワークです。',
          guidelines: [
            '[Fact]または[Theory]属性でテストメソッドを定義してください',
            'Assertクラスのメソッドを使用して検証してください',
            'コンストラクタとDisposeメソッドでテストの前後処理を定義してください',
            'IClassFixtureを使用してテスト間でデータを共有してください',
            'Moqを使用してモックを作成してください'
          ]
        };
        
      default:
        return {
          description: `${framework}はテストフレームワークです。`,
          guidelines: [
            'フレームワークの標準的なテスト構文を使用してください',
            '適切なアサーションを使用して結果を検証してください',
            'テストの前後処理を定義してください',
            'モックとスタブを適切に使用してください'
          ]
        };
    }
  }

  /**
   * ファイル拡張子から言語を取得
   */
  private getLanguageFromExtension(extension: string): string {
    const extMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.md': 'markdown',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.dart': 'dart'
    };

    return extMap[extension.toLowerCase()] || 'plaintext';
  }
}