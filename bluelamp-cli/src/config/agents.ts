/**
 * エージェント定義
 * 各エージェントはプロンプトURLとメタ情報を持つ
 */

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  promptUrl: string;
  category: 'development' | 'design' | 'planning' | 'analysis' | 'testing' | 'documentation';
  aliases?: string[]; // コマンドのエイリアス
  icon?: string; // 表示用アイコン
  initialMessage?: string; // カスタム初期メッセージ（省略時はデフォルト）
}

export const AGENTS: Record<string, AgentConfig> = {
  // 開発系エージェント
  'default': {
    id: 'default',
    name: 'General Development Assistant',
    description: '汎用的な開発支援を行うエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39',
    category: 'development',
    icon: '🔥'
  },
  
  // デザイン系エージェント
  'mockup': {
    id: 'mockup',
    name: 'Mockup Analyzer',
    description: 'モックアップの分析と生成を行うエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb',
    category: 'design',
    aliases: ['mock', 'design'],
    icon: '🎨'
  },
  
  // 要件定義系エージェント
  'requirements': {
    id: 'requirements',
    name: 'Requirements Creator',
    description: '要件定義書の作成を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_REQUIREMENTS_PROMPT_ID',
    category: 'planning',
    aliases: ['req', 'spec'],
    icon: '📋'
  },
  
  // アーキテクチャ系エージェント
  'architecture': {
    id: 'architecture',
    name: 'Architecture Designer',
    description: 'システムアーキテクチャの設計を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_ARCHITECTURE_PROMPT_ID',
    category: 'planning',
    aliases: ['arch', 'system'],
    icon: '🏗️'
  },
  
  // データモデル系エージェント
  'datamodel': {
    id: 'datamodel',
    name: 'Data Model Designer',
    description: 'データベース設計とモデリングを支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_DATAMODEL_PROMPT_ID',
    category: 'development',
    aliases: ['data', 'db', 'model'],
    icon: '🗄️'
  },
  
  // API設計系エージェント
  'api': {
    id: 'api',
    name: 'API Designer',
    description: 'REST API / GraphQLの設計を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_API_PROMPT_ID',
    category: 'development',
    aliases: ['rest', 'graphql'],
    icon: '🔌'
  },
  
  // テスト系エージェント
  'testing': {
    id: 'testing',
    name: 'Test Engineer',
    description: 'テストケースの作成と実行を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_TESTING_PROMPT_ID',
    category: 'testing',
    aliases: ['test', 'qa'],
    icon: '🧪'
  },
  
  // セキュリティ系エージェント
  'security': {
    id: 'security',
    name: 'Security Analyst',
    description: 'セキュリティ分析と脆弱性診断を行うエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_SECURITY_PROMPT_ID',
    category: 'analysis',
    aliases: ['sec', 'audit'],
    icon: '🔒'
  },
  
  // パフォーマンス系エージェント
  'performance': {
    id: 'performance',
    name: 'Performance Optimizer',
    description: 'パフォーマンス分析と最適化を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_PERFORMANCE_PROMPT_ID',
    category: 'analysis',
    aliases: ['perf', 'optimize'],
    icon: '⚡'
  },
  
  // ドキュメント系エージェント
  'documentation': {
    id: 'documentation',
    name: 'Documentation Writer',
    description: '技術ドキュメントの作成を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_DOCUMENTATION_PROMPT_ID',
    category: 'documentation',
    aliases: ['doc', 'docs'],
    icon: '📚'
  },
  
  // デプロイ系エージェント
  'deployment': {
    id: 'deployment',
    name: 'Deployment Engineer',
    description: 'CI/CDパイプラインとデプロイメントを支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_DEPLOYMENT_PROMPT_ID',
    category: 'development',
    aliases: ['deploy', 'cicd'],
    icon: '🚀'
  },
  
  // コードレビュー系エージェント
  'review': {
    id: 'review',
    name: 'Code Reviewer',
    description: 'コードレビューとベストプラクティスの提案を行うエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_REVIEW_PROMPT_ID',
    category: 'analysis',
    aliases: ['cr', 'codereview'],
    icon: '👀'
  },
  
  // リファクタリング系エージェント
  'refactor': {
    id: 'refactor',
    name: 'Refactoring Expert',
    description: 'コードのリファクタリングと改善を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_REFACTOR_PROMPT_ID',
    category: 'development',
    aliases: ['clean', 'improve'],
    icon: '♻️'
  },
  
  // プロジェクト管理系エージェント
  'project': {
    id: 'project',
    name: 'Project Manager',
    description: 'プロジェクト計画とタスク管理を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_PROJECT_PROMPT_ID',
    category: 'planning',
    aliases: ['pm', 'manage'],
    icon: '📊'
  },
  
  // UI/UX系エージェント
  'uiux': {
    id: 'uiux',
    name: 'UI/UX Designer',
    description: 'ユーザーインターフェースとエクスペリエンスの設計を支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_UIUX_PROMPT_ID',
    category: 'design',
    aliases: ['ui', 'ux', 'interface'],
    icon: '🎯'
  },
  
  // データ分析系エージェント
  'analytics': {
    id: 'analytics',
    name: 'Data Analyst',
    description: 'データ分析とビジュアライゼーションを支援するエージェント',
    promptUrl: 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/YOUR_ANALYTICS_PROMPT_ID',
    category: 'analysis',
    aliases: ['data-analysis', 'bi'],
    icon: '📈'
  }
};

// エージェントを検索する関数
export function findAgent(nameOrAlias: string): AgentConfig | undefined {
  // 直接IDで検索
  if (AGENTS[nameOrAlias]) {
    return AGENTS[nameOrAlias];
  }
  
  // エイリアスで検索
  for (const agent of Object.values(AGENTS)) {
    if (agent.aliases?.includes(nameOrAlias)) {
      return agent;
    }
  }
  
  return undefined;
}

// カテゴリごとにエージェントを取得
export function getAgentsByCategory(category: AgentConfig['category']): AgentConfig[] {
  return Object.values(AGENTS).filter(agent => agent.category === category);
}

// すべてのエージェントのリストを取得
export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENTS);
}