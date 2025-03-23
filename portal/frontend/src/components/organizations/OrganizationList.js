import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Table, 
  Button, 
  Card, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Tooltip, 
  message,
  Progress
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TeamOutlined,
  BarChartOutlined,
  KeyOutlined,
  SyncOutlined
} from '@ant-design/icons';
import organizationService from '../../services/organization.service';
import './OrganizationList.css';

/**
 * 組織一覧コンポーネント
 * 組織の一覧表示と新規作成機能を提供
 */
const OrganizationList = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  // 新規作成はフォームページで行うため、モーダル関連のステートは不要
  const [includeArchived, setIncludeArchived] = useState(false);

  // 組織一覧を取得
  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await organizationService.getOrganizations({
        includeArchived
      });
      setOrganizations(data);
    } catch (error) {
      console.error('組織一覧取得エラー:', error);
      message.error('組織情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時に組織一覧を取得
  useEffect(() => {
    fetchOrganizations();
  }, [includeArchived]);

  // 新規組織作成は直接 /organizations/new へのリダイレクトで行うため、
  // 個別のハンドラは不要

  // 組織削除確認モーダル
  const confirmDelete = (organization) => {
    Modal.confirm({
      title: '組織を削除しますか？',
      content: `組織「${organization.name}」を完全に削除します。この操作は取り消せず、組織に関連するすべてのデータも削除されます。`,
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await organizationService.deleteOrganization(organization._id);
          message.success('組織が完全に削除されました');
          fetchOrganizations(); // 一覧を再取得
        } catch (error) {
          console.error('組織削除エラー:', error);
          message.error('組織の削除に失敗しました');
        }
      },
    });
  };

  // 組織のステータスに応じたタグを生成
  const getStatusTag = (status, isArchived) => {
    if (isArchived) {
      return <Tag color="gray">アーカイブ済み</Tag>;
    }

    switch (status) {
      case 'active':
        return <Tag color="green">有効</Tag>;
      case 'suspended':
        return <Tag color="red">停止中</Tag>;
      case 'pending':
        return <Tag color="orange">保留中</Tag>;
      default:
        return <Tag color="blue">{status}</Tag>;
    }
  };

  // テーブルのカラム定義
  const columns = [
    {
      title: '組織名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/organizations/${record._id}`}>{text}</Link>
      ),
    },
    {
      title: '管理者',
      dataIndex: 'adminId',
      key: 'adminId',
      render: (admin) => admin?.username || admin?.email || '-',
    },
    {
      title: 'メンバー数',
      dataIndex: 'members',
      key: 'members',
      render: (members, record) => {
        const memberCount = members?.length || 0;
        const maxUsers = record.maxUsers || 5;
        const percentage = (memberCount / maxUsers) * 100;
        
        return (
          <Tooltip title={`${memberCount} / ${maxUsers} 人`}>
            <div>
              {memberCount} / {maxUsers} 人
              <Progress 
                percent={percentage} 
                size="small" 
                style={{ marginTop: '5px' }}
                status={percentage >= 90 ? 'exception' : 'normal'}
              />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record.isArchived),
    },
    {
      title: 'トークン使用量',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage, record) => {
        if (!usage) return '-';
        
        const percentage = usage.budgetPercentage || 0;
        let color = 'green';
        if (percentage > 80) color = 'red';
        else if (percentage > 60) color = 'orange';
        
        return (
          <Tooltip title={`${usage.totalTokens.toLocaleString()} / ${(record.monthlyBudget || 0).toLocaleString()} トークン`}>
            <Progress percent={percentage} size="small" status={percentage >= 100 ? 'exception' : 'normal'} strokeColor={color} />
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Link to={`/organizations/${record._id}`}>
            <Button type="text" icon={<EditOutlined />} disabled={record.isArchived} />
          </Link>
          <Link to={`/organizations/${record._id}/members`}>
            <Button type="text" icon={<TeamOutlined />} disabled={record.isArchived} />
          </Link>
          <Link to={`/organizations/${record._id}/usage`}>
            <Button type="text" icon={<BarChartOutlined />} />
          </Link>
          <Link to={`/organizations/${record._id}/apikeys`}>
            <Button type="text" icon={<KeyOutlined />} disabled={record.isArchived} />
          </Link>
          {!record.isArchived && (
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => confirmDelete(record)} 
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="organization-list-container">
      <Card
        title="組織一覧"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={fetchOrganizations}
            >
              更新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => window.location.href = '/organizations/new'}
            >
              新規組織
            </Button>
          </Space>
        }
      >
        <div className="table-options">
          <Space>
            <span>アーカイブ組織を表示: </span>
            <Button 
              type={includeArchived ? "primary" : "default"} 
              size="small"
              onClick={() => setIncludeArchived(!includeArchived)}
            >
              {includeArchived ? "表示中" : "非表示"}
            </Button>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={organizations}
          rowKey="_id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </Card>

      {/* 新規組織作成は /organizations/new ページで行うため、モーダル不要 */}
    </div>
  );
};

export default OrganizationList;