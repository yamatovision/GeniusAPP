#!/usr/bin/env node

// BlueLamp CLI ツール機能を直接テストするスクリプト
const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

// ツール定義（実装と同じ）
const tools = [
  {
    name: 'write',
    description: 'ファイルに内容を書き込む',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'ファイルパス' },
        content: { type: 'string', description: 'ファイル内容' }
      },
      required: ['file_path', 'content']
    }
  }
];

async function testClaudeToolCall() {
  const client = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  console.log('🧪 Claude API ツール呼び出しテスト開始\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.7,
      system: 'あなたは指示に従ってツールを使用するアシスタントです。',
      messages: [
        {
          role: 'user',
          content: 'test.txtというファイルに「Hello World」という内容を書き込んでください'
        }
      ],
      tools: tools
    });

    console.log('📤 Claude API レスポンス:');
    console.log('Content blocks:', response.content.length);

    for (let i = 0; i < response.content.length; i++) {
      const block = response.content[i];
      console.log(`\nBlock ${i + 1}:`);
      console.log('Type:', block.type);
      
      if (block.type === 'text') {
        console.log('Text:', block.text);
      } else if (block.type === 'tool_use') {
        console.log('🔧 Tool Call Detected!');
        console.log('Tool Name:', block.name);
        console.log('Tool Input:', JSON.stringify(block.input, null, 2));
        
        // バグ検証: contentパラメータの有無をチェック
        if (block.name === 'write') {
          console.log('\n🔍 Write Tool バグ検証:');
          console.log('file_path:', block.input.file_path);
          console.log('content:', block.input.content);
          console.log('content is undefined?', block.input.content === undefined);
          console.log('content is null?', block.input.content === null);
          console.log('content type:', typeof block.input.content);
        }
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

testClaudeToolCall();