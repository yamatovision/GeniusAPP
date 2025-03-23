import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  Modal, 
  Tooltip, 
  Tag, 
  Space, 
  Spin, 
  Alert, 
  Progress,
  message
} from 'antd';
import { 
  BarChartOutlined, 
  EditOutlined, 
  SaveOutlined, 
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import adminService from '../../services/admin.service';
import './UsageLimits.css';

const { Option } = Select;
const { confirm } = Modal;

/**
 * 使用制限管理コンポーネント
 * 組織・ワークスペースごとの使用量制限管理機能を提供
 */
const UsageLimits = () => {
  // 状態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 初期データ読み込み
  useEffect(() => {
    fetchOrganizationsWithLimits();
  }, []);

  // 組織と制限データの取得
  const fetchOrganizationsWithLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      // 実際のAPIエンドポイントに合わせて調整してください
      const data = await adminService.getAllOrganizations({ includeDetails: true });
      setOrganizations(data);
    } catch (err) {
      console.error('組織データ取得エラー:', err);
      setError('組織データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // 編集モーダルを開く
  const handleEdit = (record) => {
    setEditingRecord(record);
    
    // フォームの初期値を設定
    form.setFieldsValue({
      tokenLimit: record.usageLimits?.tokenLimit || 0,
      dailyTokenLimit: record.usageLimits?.dailyTokenLimit || 0,
      requestLimit: record.usageLimits?.requestLimit || 0,
      alertThreshold: record.usageLimits?.alertThreshold || 80,
      alertContacts: record.usageLimits?.alertContacts || '',
      actionOnLimit: record.usageLimits?.actionOnLimit || 'notify',
    });
    
    setEditModalVisible(true);
  };

  // 制限を更新
  const handleUpdateLimits = async (values) => {
    setLoading(true);
    try {
      // 実際のAPIエンドポイントに合わせて調整してください
      await adminService.updateOrganizationLimits(editingRecord.id, values);
      message.success(`${editingRecord.name}の使用制限が更新されました`);
      setEditModalVisible(false);
      fetchOrganizationsWithLimits(); // データを再取得
    } catch (error) {
      console.error('使用制限更新エラー:', error);
      message.error('使用制限の更新に失敗しました: ' + (error.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // テーブルカラム定義
  const columns = [
    {
      title: '組織名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span>
          {text}
          {record.isEnterprise && (
            <Tag color="gold" style={{ marginLeft: 8 }}>Enterprise</Tag>
          )}
        </span>
      ),
    },
    {
      title: 'トークン使用制限',
      dataIndex: ['usageLimits', 'tokenLimit'],
      key: 'tokenLimit',
      render: (limit, record) => {
        if (!limit) return <span>未設定</span>;
        
        const percentage = record.totalTokens / limit * 100;
        const tooltipTitle = `${record.totalTokens.toLocaleString()} / ${limit.toLocaleString()} トークン使用中`;
        
        return (
          <Tooltip title={tooltipTitle}>
            <div style={{ width: '150px' }}>
              <Progress 
                percent={Math.min(percentage, 100)} 
                size="small" 
                status={percentage >= 100 ? 'exception' : 'normal'} 
                strokeColor={
                  percentage >= 90 ? '#f5222d' :
                  percentage >= 70 ? '#faad14' :
                  '#52c41a'
                }
              />
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                {`${Math.round(percentage)}% 使用中`}
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '日次制限',
      dataIndex: ['usageLimits', 'dailyTokenLimit'],
      key: 'dailyTokenLimit',
      render: limit => limit ? limit.toLocaleString() : '未設定',
    },
    {
      title: 'リクエスト制限',
      dataIndex: ['usageLimits', 'requestLimit'],
      key: 'requestLimit',
      render: limit => limit ? limit.toLocaleString() : '未設定',
    },
    {
      title: 'アラート閾値',
      dataIndex: ['usageLimits', 'alertThreshold'],
      key: 'alertThreshold',
      render: threshold => threshold ? `${threshold}%` : '80%',
    },
    {
      title: '制限到達時の動作',
      dataIndex: ['usageLimits', 'actionOnLimit'],
      key: 'actionOnLimit',
      render: action => {
        switch(action) {
          case 'block':
            return <Tag color="red">ブロック</Tag>;
          case 'throttle':
            return <Tag color="orange">スロットル</Tag>;
          case 'notify':
          default:
            return <Tag color="blue">通知のみ</Tag>;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => handleEdit(record)}
        >
          編集
        </Button>
      ),
    },
  ];

  return (
    <div className="usage-limits-container">
      <Card 
        title={
          <span>
            <BarChartOutlined /> 使用量制限管理
          </span>
        } 
        extra={
          <Button 
            onClick={() => fetchOrganizationsWithLimits()}
            loading={loading}
          >
            更新
          </Button>
        }
        className="usage-limits-card"
      >
        {/* エラーメッセージ */}
        {error && (
          <Alert 
            message="エラー" 
            description={error} 
            type="error" 
            showIcon 
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* テーブル */}
        {loading && organizations.length === 0 ? (
          <div className="loading-container">
            <Spin size="large" />
            <p>データを読み込んでいます...</p>
          </div>
        ) : (
          <Table 
            dataSource={organizations} 
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* 編集モーダル */}
      <Modal
        title={`使用制限の編集: ${editingRecord?.name || ''}`}
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateLimits}
        >
          <Form.Item
            name="tokenLimit"
            label="月間トークン制限"
            tooltip="月間で使用可能なトークンの総数を設定します"
            rules={[{ required: true, message: '月間トークン制限を入力してください' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={10000}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
              placeholder="例: 1,000,000"
            />
          </Form.Item>

          <Form.Item
            name="dailyTokenLimit"
            label="日次トークン制限"
            tooltip="1日あたりのトークン使用制限を設定します"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
              placeholder="例: 100,000"
            />
          </Form.Item>

          <Form.Item
            name="requestLimit"
            label="APIリクエスト制限"
            tooltip="月間のAPIリクエスト回数制限を設定します"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={100}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
              placeholder="例: 10,000"
            />
          </Form.Item>

          <Form.Item
            name="alertThreshold"
            label="アラート閾値"
            tooltip="使用制限のこの割合に達したらアラートを送信します"
            rules={[{ required: true, message: 'アラート閾値を入力してください' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={100}
              formatter={value => `${value}%`}
              parser={value => value.replace('%', '')}
              placeholder="例: 80%"
            />
          </Form.Item>

          <Form.Item
            name="alertContacts"
            label="アラート通知先"
            tooltip="アラート時に通知するメールアドレス（複数の場合はカンマ区切り）"
          >
            <Input placeholder="例: admin@example.com, manager@example.com" />
          </Form.Item>

          <Form.Item
            name="actionOnLimit"
            label="制限到達時の動作"
            tooltip="使用制限に達した場合の動作を設定します"
            rules={[{ required: true, message: '制限到達時の動作を選択してください' }]}
          >
            <Select placeholder="動作を選択">
              <Option value="notify">
                <InfoCircleOutlined style={{ color: '#1890ff' }} /> 通知のみ（APIキーは有効のまま）
              </Option>
              <Option value="throttle">
                <WarningOutlined style={{ color: '#faad14' }} /> スロットル（要求を低速化）
              </Option>
              <Option value="block">
                <WarningOutlined style={{ color: '#f5222d' }} /> ブロック（APIキーを一時停止）
              </Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModalVisible(false)}>
                キャンセル
              </Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsageLimits;