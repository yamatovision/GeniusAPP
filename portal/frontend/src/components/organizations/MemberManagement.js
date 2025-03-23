import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Select, 
  message, 
  Popconfirm,
  Input,
  Skeleton,
  Alert,
  Tooltip
} from 'antd';
import { 
  UserAddOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  SyncOutlined,
  LeftOutlined,
  SearchOutlined
} from '@ant-design/icons';
import organizationService from '../../services/organization.service';
import workspaceService from '../../services/workspace.service';
import userService from '../../services/user.service';
import './MemberManagement.css';

const { Option } = Select;

/**
 * メンバー管理コンポーネント
 * 組織または組織のデフォルトワークスペース、あるいは従来のワークスペースのメンバー管理機能を提供
 */
const MemberManagement = () => {
  const { id, organizationId, workspaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [organization, setOrganization] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [addMemberForm] = Form.useForm();
  const [editMemberModalVisible, setEditMemberModalVisible] = useState(false);
  const [editMemberForm] = Form.useForm();
  const [currentMember, setCurrentMember] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isWorkspaceMembers, setIsWorkspaceMembers] = useState(false);
  const [isDefaultWorkspace, setIsDefaultWorkspace] = useState(false);
  
  // URLパスを分析してメンバー管理の対象を判断
  useEffect(() => {
    const path = location.pathname;
    // ワークスペースメンバー管理の場合
    if (path.includes('/workspaces/') && path.includes('/members')) {
      setIsWorkspaceMembers(true);
      setIsDefaultWorkspace(false);
    } 
    // 組織のデフォルトワークスペースメンバー管理の場合
    else if (path.includes('/organizations/') && path.includes('/workspace/members')) {
      setIsWorkspaceMembers(true);
      setIsDefaultWorkspace(true);
    }
    // 組織メンバー管理の場合
    else {
      setIsWorkspaceMembers(false);
      setIsDefaultWorkspace(false);
    }
  }, [location.pathname]);

  // 組織またはワークスペース詳細を取得
  const fetchEntityDetails = async () => {
    try {
      setLoading(true);
      if (isWorkspaceMembers) {
        if (isDefaultWorkspace) {
          // 組織のデフォルトワークスペース情報を取得
          const data = await organizationService.getDefaultWorkspace(id || organizationId);
          setWorkspace(data);
          // 組織情報も取得
          const orgData = await organizationService.getOrganizationById(id || organizationId);
          setOrganization(orgData);
        } else if (organizationId && workspaceId) {
          // 組織コンテキスト内のワークスペース情報を取得
          const data = await workspaceService.getWorkspaceById(workspaceId);
          setWorkspace(data);
          // 組織情報も取得
          const orgData = await organizationService.getOrganizationById(organizationId);
          setOrganization(orgData);
        } else {
          // 従来のワークスペース情報を取得
          const data = await workspaceService.getWorkspaceById(id);
          setWorkspace(data);
          if (data && data.organizationId) {
            // 関連する組織情報も取得
            const orgData = await organizationService.getOrganizationById(data.organizationId);
            setOrganization(orgData);
          }
        }
      } else {
        // 組織情報を取得
        const data = await organizationService.getOrganizationById(id);
        setOrganization(data);
      }
    } catch (error) {
      console.error(isWorkspaceMembers ? 'ワークスペース詳細取得エラー:' : '組織詳細取得エラー:', error);
      message.error(isWorkspaceMembers ? 'ワークスペース情報の取得に失敗しました' : '組織情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // メンバー一覧を取得
  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      let data;
      
      if (isWorkspaceMembers) {
        if (isDefaultWorkspace) {
          // 組織のデフォルトワークスペースメンバー一覧を取得
          data = await organizationService.getDefaultWorkspaceMembers(id || organizationId);
          setMembers(data.workspaceMembers || []);
        } else if (organizationId && workspaceId) {
          // 組織コンテキスト内のワークスペースメンバー一覧を取得
          data = await workspaceService.getWorkspaceMembers(workspaceId);
          setMembers(data.workspaceMembers || []);
        } else {
          // 従来のワークスペースメンバー一覧を取得
          data = await workspaceService.getWorkspaceMembers(id);
          setMembers(data.workspaceMembers || []);
        }
      } else {
        // 組織メンバー一覧を取得
        data = await organizationService.getOrganizationMembers(id);
        setMembers(data || []);
      }
    } catch (error) {
      console.error(isWorkspaceMembers ? 'ワークスペースメンバー一覧取得エラー:' : '組織メンバー一覧取得エラー:', error);
      message.error('メンバー情報の取得に失敗しました');
    } finally {
      setMembersLoading(false);
    }
  };

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await userService.getUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('ユーザー一覧取得エラー:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  // コンポーネントマウント時およびパラメータ変更時にデータを取得
  useEffect(() => {
    fetchEntityDetails();
    fetchMembers();
    fetchUsers();
  }, [id, organizationId, workspaceId, isWorkspaceMembers, isDefaultWorkspace]);

  // メンバー追加ハンドラ
  const handleAddMember = async (values) => {
    try {
      if (isWorkspaceMembers) {
        if (isDefaultWorkspace) {
          // 組織のデフォルトワークスペースにメンバーを追加
          await organizationService.addDefaultWorkspaceMember(id || organizationId, values);
        } else if (organizationId && workspaceId) {
          // 組織コンテキスト内のワークスペースにメンバーを追加
          await workspaceService.addWorkspaceMember(workspaceId, values);
        } else {
          // 従来のワークスペースにメンバーを追加
          await workspaceService.addWorkspaceMember(id, values);
        }
      } else {
        // 組織にメンバーを追加
        await organizationService.addOrganizationMember(id, values);
      }
      
      message.success('メンバーが追加されました');
      setAddMemberModalVisible(false);
      addMemberForm.resetFields();
      fetchMembers(); // メンバー一覧を再取得
    } catch (error) {
      console.error('メンバー追加エラー:', error);
      message.error('メンバーの追加に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // メンバー役割更新ハンドラ
  const handleUpdateMemberRole = async (values) => {
    try {
      const memberId = currentMember.userId._id;
      
      if (isWorkspaceMembers) {
        if (isDefaultWorkspace) {
          // 組織のデフォルトワークスペースメンバーの役割を更新
          await organizationService.updateDefaultWorkspaceMemberRole(id || organizationId, memberId, values);
        } else if (organizationId && workspaceId) {
          // 組織コンテキスト内のワークスペースメンバーの役割を更新
          await workspaceService.updateWorkspaceMemberRole(workspaceId, memberId, values);
        } else {
          // 従来のワークスペースメンバーの役割を更新
          await workspaceService.updateWorkspaceMemberRole(id, memberId, values);
        }
      } else {
        // 組織メンバーの役割を更新
        await organizationService.updateOrganizationMemberRole(id, memberId, values);
      }
      
      message.success('メンバーの役割が更新されました');
      setEditMemberModalVisible(false);
      editMemberForm.resetFields();
      fetchMembers(); // メンバー一覧を再取得
    } catch (error) {
      console.error('メンバー役割更新エラー:', error);
      message.error('メンバーの役割更新に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // メンバー削除ハンドラ
  const handleRemoveMember = async (memberId) => {
    try {
      if (isWorkspaceMembers) {
        if (isDefaultWorkspace) {
          // 組織のデフォルトワークスペースからメンバーを削除
          await organizationService.removeDefaultWorkspaceMember(id || organizationId, memberId);
        } else if (organizationId && workspaceId) {
          // 組織コンテキスト内のワークスペースからメンバーを削除
          await workspaceService.removeWorkspaceMember(workspaceId, memberId);
        } else {
          // 従来のワークスペースからメンバーを削除
          await workspaceService.removeWorkspaceMember(id, memberId);
        }
      } else {
        // 組織からメンバーを削除
        await organizationService.removeOrganizationMember(id, memberId);
      }
      
      message.success('メンバーが削除されました');
      fetchMembers(); // メンバー一覧を再取得
    } catch (error) {
      console.error('メンバー削除エラー:', error);
      message.error('メンバーの削除に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // 編集モーダルを開く
  const openEditModal = (member) => {
    setCurrentMember(member);
    editMemberForm.setFieldsValue({
      role: member.role
    });
    setEditMemberModalVisible(true);
  };

  // メンバーの役割に応じたタグを生成
  const getRoleTag = (role) => {
    switch (role) {
      case 'admin':
        return <Tag color="red">管理者</Tag>;
      case 'member':
        return <Tag color="blue">メンバー</Tag>;
      default:
        return <Tag>{role}</Tag>;
    }
  };

  // フィルタリングされていないユーザーを取得
  const getFilteredUsers = () => {
    if (!members || !users) return [];
    
    const memberUserIds = members.map(m => m.userId._id);
    return users.filter(user => !memberUserIds.includes(user._id));
  };

  // テーブルのカラム定義
  const columns = [
    {
      title: 'メンバー名',
      dataIndex: ['userId', 'username'],
      key: 'username',
      render: (text, record) => {
        const username = record.userId.username || record.userId.email || '不明なユーザー';
        return username;
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="名前で検索"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              検索
            </Button>
            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
              リセット
            </Button>
          </Space>
        </div>
      ),
      filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
      onFilter: (value, record) => {
        const username = record.userId.username || record.userId.email || '';
        return username.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: 'メールアドレス',
      dataIndex: ['userId', 'email'],
      key: 'email',
    },
    {
      title: '役割',
      dataIndex: 'role',
      key: 'role',
      render: (role) => getRoleTag(role),
      filters: [
        { text: '管理者', value: 'admin' },
        { text: 'メンバー', value: 'member' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: '参加日',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        // 自分自身の場合は操作を制限
        const isCurrentUser = localStorage.getItem('userId') === record.userId._id;
        // 最後の管理者の場合は操作を制限
        const isLastAdmin = record.role === 'admin' && members.filter(m => m.role === 'admin').length === 1;
        
        return (
          <Space size="small">
            <Tooltip title={isLastAdmin ? "最後の管理者は役割を変更できません" : ""}>
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => openEditModal(record)}
                disabled={isLastAdmin}
              />
            </Tooltip>
            <Tooltip title={isLastAdmin ? "最後の管理者は削除できません" : (isCurrentUser ? "自分自身は削除できません" : "")}>
              <Popconfirm
                title="このメンバーを組織から削除しますか？"
                onConfirm={() => handleRemoveMember(record.userId._id)}
                okText="はい"
                cancelText="いいえ"
                disabled={isLastAdmin || isCurrentUser}
              >
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  disabled={isLastAdmin || isCurrentUser}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // 戻るリンクのURLを生成
  const getBackLink = () => {
    if (isWorkspaceMembers) {
      if (isDefaultWorkspace) {
        return `/organizations/${id || organizationId}`;
      } else if (organizationId && workspaceId) {
        return `/organizations/${organizationId}/workspaces/${workspaceId}`;
      } else {
        return `/workspaces/${id}`;
      }
    } else {
      return `/organizations/${id}`;
    }
  };

  // カードタイトルを生成
  const getCardTitle = () => {
    if (isWorkspaceMembers) {
      return `ワークスペースメンバー管理: ${workspace?.name || ''}`;
    } else {
      return `組織メンバー管理: ${organization?.name || ''}`;
    }
  };

  // 更新機能を呼び出す
  const refreshMembers = () => {
    fetchMembers();
  };

  // アーカイブ状態を確認
  const isArchived = () => {
    if (isWorkspaceMembers) {
      return workspace?.isArchived || false;
    } else {
      return organization?.isArchived || false;
    }
  };

  return (
    <div className="member-management-container">
      <Button 
        type="link" 
        icon={<LeftOutlined />} 
        onClick={() => navigate(getBackLink())} 
        style={{ marginBottom: '16px' }}
      >
        {isWorkspaceMembers ? 'ワークスペース詳細に戻る' : '組織詳細に戻る'}
      </Button>
      
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Card
            title={getCardTitle()}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={refreshMembers}
                >
                  更新
                </Button>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => setAddMemberModalVisible(true)}
                  disabled={isArchived()}
                >
                  メンバー追加
                </Button>
              </Space>
            }
          >
            {isArchived() && (
              <Alert 
                message={isWorkspaceMembers 
                  ? "このワークスペースはアーカイブされています。メンバーの追加や変更はできません。" 
                  : "この組織はアーカイブされています。メンバーの追加や変更はできません。"
                } 
                type="warning" 
                showIcon 
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <Table
              columns={columns}
              dataSource={members}
              rowKey={(record) => record.userId._id}
              loading={membersLoading}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
              }}
            />
          </Card>

          {/* メンバー追加モーダル */}
          <Modal
            title="メンバー追加"
            open={addMemberModalVisible}
            onCancel={() => setAddMemberModalVisible(false)}
            footer={null}
          >
            <Form
              form={addMemberForm}
              layout="vertical"
              onFinish={handleAddMember}
            >
              <Form.Item
                name="userId"
                label="ユーザー"
                rules={[{ required: true, message: 'ユーザーを選択してください' }]}
              >
                <Select
                  placeholder="ユーザーを選択"
                  loading={usersLoading}
                  showSearch
                  optionFilterProp="children"
                >
                  {getFilteredUsers().map(user => (
                    <Option key={user._id} value={user._id}>
                      {user.username || user.email}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item
                name="role"
                label="役割"
                initialValue={isWorkspaceMembers ? "workspace_user" : "member"}
                rules={[{ required: true, message: '役割を選択してください' }]}
              >
                <Select placeholder="役割を選択">
                  {isWorkspaceMembers ? (
                    <>
                      <Option value="workspace_admin">ワークスペース管理者</Option>
                      <Option value="workspace_developer">開発者</Option>
                      <Option value="workspace_user">一般ユーザー</Option>
                    </>
                  ) : (
                    <>
                      <Option value="admin">管理者</Option>
                      <Option value="member">メンバー</Option>
                    </>
                  )}
                </Select>
              </Form.Item>
              
              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setAddMemberModalVisible(false)}>
                    キャンセル
                  </Button>
                  <Button type="primary" htmlType="submit">
                    追加
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* メンバー編集モーダル */}
          <Modal
            title="メンバー役割の編集"
            open={editMemberModalVisible}
            onCancel={() => setEditMemberModalVisible(false)}
            footer={null}
          >
            {currentMember && (
              <Form
                form={editMemberForm}
                layout="vertical"
                onFinish={handleUpdateMemberRole}
              >
                <p>
                  <strong>メンバー:</strong> {currentMember.userId.username || currentMember.userId.email}
                </p>
                
                <Form.Item
                  name="role"
                  label="役割"
                  initialValue={currentMember.role}
                  rules={[{ required: true, message: '役割を選択してください' }]}
                >
                  <Select placeholder="役割を選択">
                    {isWorkspaceMembers ? (
                      <>
                        <Option value="workspace_admin">ワークスペース管理者</Option>
                        <Option value="workspace_developer">開発者</Option>
                        <Option value="workspace_user">一般ユーザー</Option>
                      </>
                    ) : (
                      <>
                        <Option value="admin">管理者</Option>
                        <Option value="member">メンバー</Option>
                      </>
                    )}
                  </Select>
                </Form.Item>
                
                <Form.Item>
                  <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button onClick={() => setEditMemberModalVisible(false)}>
                      キャンセル
                    </Button>
                    <Button type="primary" htmlType="submit">
                      更新
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </Modal>
        </>
      )}
    </div>
  );
};

export default MemberManagement;