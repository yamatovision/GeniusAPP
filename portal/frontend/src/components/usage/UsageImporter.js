import React, { useState } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  message, 
  Alert, 
  Progress, 
  Space, 
  Typography, 
  Divider,
  Select,
  Table,
  Tag,
  Modal
} from 'antd';
import { 
  InboxOutlined, 
  FileExcelOutlined, 
  QuestionCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
import usageService from '../../services/usage.service';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * トークン使用量データのCSVインポートコンポーネント
 * Anthropicコンソールからダウンロードしたデータをインポート
 */
const UsageImporter = ({ organizations = [], onImportComplete }) => {
  // 状態管理
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  
  // ファイルアップロードの設定
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    fileList,
    beforeUpload: (file) => {
      // CSVファイルのみ許可
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      if (!isCSV) {
        message.error('CSVファイルのみアップロード可能です');
        return Upload.LIST_IGNORE;
      }
      
      // ファイルサイズチェック（10MB上限）
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('ファイルサイズは10MB以下にしてください');
        return Upload.LIST_IGNORE;
      }
      
      setFileList([file]);
      return false; // 自動アップロードを防止
    },
    onRemove: () => {
      setFileList([]);
      return true;
    }
  };
  
  // インポート結果テーブルのカラム定義
  const resultColumns = [
    {
      title: 'APIキーID',
      dataIndex: 'apiKeyId',
      key: 'apiKeyId',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'ユーザー',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: 'トークン数',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: val => val.toLocaleString(),
    },
    {
      title: 'リクエスト数',
      dataIndex: 'requests',
      key: 'requests',
      sorter: (a, b) => a.requests - b.requests,
      render: val => val.toLocaleString(),
    },
  ];
  
  // 組織選択ハンドラ
  const handleOrganizationChange = (value) => {
    setSelectedOrganization(value);
  };
  
  // CSVインポート実行ハンドラ
  const handleImport = async () => {
    if (!selectedOrganization) {
      message.error('組織を選択してください');
      return;
    }
    
    if (fileList.length === 0) {
      message.error('CSVファイルを選択してください');
      return;
    }
    
    setUploading(true);
    setError(null);
    setImportResult(null);
    
    const formData = new FormData();
    formData.append('file', fileList[0]);
    
    try {
      const result = await usageService.importUsageData(selectedOrganization, formData);
      
      setImportResult(result);
      message.success('CSVデータのインポートが完了しました');
      
      // アップロード完了後、ファイルリストをクリア
      setFileList([]);
      
      // 完了コールバックを呼び出し
      if (typeof onImportComplete === 'function') {
        onImportComplete(result);
      }
    } catch (err) {
      console.error('CSVインポートエラー:', err);
      setError(err.response?.data?.error || err.message || 'CSVデータのインポートに失敗しました');
      message.error('CSVデータのインポートに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card title="トークン使用量データのインポート" className="usage-importer-card">
      <div style={{ marginBottom: 20 }}>
        <Paragraph>
          <Text>Anthropicコンソールからダウンロードした使用量データをインポートして、アプリ内で統計情報を管理できます。</Text>
          <Button 
            type="link" 
            icon={<QuestionCircleOutlined />}
            onClick={() => setHelpModalVisible(true)}
          >
            ヘルプを表示
          </Button>
        </Paragraph>
        
        <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }}>
          <Text strong>手順:</Text>
          <ol>
            <li>インポート先の組織を選択</li>
            <li>AnthropicコンソールからダウンロードしたCSVファイルをアップロード</li>
            <li>「インポート実行」ボタンをクリック</li>
          </ol>
        </Space>
      </div>
      
      {/* 組織選択 */}
      <div style={{ marginBottom: 20 }}>
        <Text strong>組織の選択:</Text>
        <Select
          style={{ width: '100%', marginTop: 8 }}
          placeholder="インポート先の組織を選択してください"
          value={selectedOrganization}
          onChange={handleOrganizationChange}
        >
          {organizations.map(org => (
            <Option key={org._id} value={org._id}>{org.name}</Option>
          ))}
        </Select>
      </div>
      
      {/* ファイルアップローダー */}
      <Dragger {...uploadProps} style={{ marginBottom: 20 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">クリックまたはドラッグでCSVファイルをアップロード</p>
        <p className="ant-upload-hint">
          <FileExcelOutlined /> Anthropicコンソールからダウンロードした使用量CSVファイルに対応しています
        </p>
      </Dragger>
      
      {/* インポートボタン */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button
          type="primary"
          onClick={handleImport}
          disabled={fileList.length === 0 || !selectedOrganization || uploading}
          loading={uploading}
          icon={<UploadOutlined />}
        >
          {uploading ? 'インポート中...' : 'インポート実行'}
        </Button>
      </div>
      
      {/* エラーメッセージ */}
      {error && (
        <Alert
          message="インポートエラー"
          description={error}
          type="error"
          showIcon
          style={{ marginTop: 20 }}
        />
      )}
      
      {/* インポート結果 */}
      {importResult && (
        <div style={{ marginTop: 20 }}>
          <Divider>インポート結果</Divider>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <Text strong>処理レコード数:</Text> {importResult.stats.recordsProcessed.toLocaleString()}
              </div>
              <div>
                <Text strong>スキップされたレコード:</Text> {importResult.stats.recordsSkipped.toLocaleString()}
              </div>
              <div>
                <Text strong>エラーレコード:</Text> {importResult.stats.recordsFailed.toLocaleString()}
              </div>
              <div>
                <Text strong>合計トークン:</Text> {importResult.stats.totalTokens.toLocaleString()}
              </div>
            </div>
            
            <Progress
              percent={Math.round(importResult.stats.recordsProcessed / (importResult.stats.recordsProcessed + importResult.stats.recordsSkipped + importResult.stats.recordsFailed) * 100)}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              style={{ marginTop: 10, marginBottom: 20 }}
            />
            
            {importResult.errors && importResult.errors.length > 0 && (
              <Alert
                message="エラー詳細"
                description={
                  <ul>
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 20 }}
              />
            )}
            
            {/* ユーザー別集計結果テーブル */}
            {importResult.stats.userStats && importResult.stats.userStats.length > 0 && (
              <>
                <Title level={5}>ユーザー別集計</Title>
                <Table
                  dataSource={importResult.stats.userStats}
                  columns={resultColumns}
                  rowKey="apiKeyId"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </>
            )}
          </Space>
        </div>
      )}
      
      {/* ヘルプモーダル */}
      <Modal
        title="CSVインポートヘルプ"
        open={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHelpModalVisible(false)}>
            閉じる
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <Title level={4}>CSVファイルの形式について</Title>
          <Paragraph>
            インポート可能なCSVファイルは、Anthropicコンソールからダウンロードした使用量データで、以下のフィールドを含む必要があります:
          </Paragraph>
          
          <ul>
            <li><Text code>request_id</Text> - リクエストの一意のID</li>
            <li><Text code>timestamp</Text> - リクエストのタイムスタンプ</li>
            <li><Text code>api_key_id</Text> - 使用されたAPIキーのID</li>
            <li><Text code>input_tokens</Text> - 入力トークン数</li>
            <li><Text code>output_tokens</Text> - 出力トークン数</li>
          </ul>
          
          <Title level={4}>インポートの流れ</Title>
          <ol>
            <li>Anthropicコンソールにアクセスし、使用量レポートをCSVでダウンロードします</li>
            <li>このページで組織を選択し、ダウンロードしたCSVファイルをアップロードします</li>
            <li>システムはユーザーのAPIキーIDとの関連付けを行い、使用量を集計します</li>
            <li>インポートが完了すると、ユーザー別の集計結果が表示されます</li>
          </ol>
          
          <Title level={4}>注意事項</Title>
          <ul>
            <li>APIキーIDがシステムに登録されていないユーザーの使用量は、組織管理者に関連付けられます</li>
            <li>同じリクエストIDのデータは重複してインポートされません</li>
            <li>ファイルサイズは10MB以下にしてください</li>
            <li>インポートには管理者権限が必要です</li>
          </ul>
        </div>
      </Modal>
    </Card>
  );
};

export default UsageImporter;