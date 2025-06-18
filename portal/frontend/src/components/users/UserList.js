import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Table, Button, Form, InputGroup, Dropdown, DropdownButton, Pagination, Card, Alert, Modal, Spinner } from 'react-bootstrap';
import { FaSearch, FaEdit, FaTrash, FaPlus, FaUserCog, FaUserShield, FaSort, FaSortUp, FaSortDown, FaBan, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import userService from '../../services/user.service';
import './UserList.css';

/**
 * ユーザー一覧コンポーネント
 * 管理者向けのユーザー管理画面
 */
const UserList = () => {
  // ステート
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [apiToggleLoading, setApiToggleLoading] = useState({});
  
  const navigate = useNavigate();
  
  // 初期データ読み込み
  useEffect(() => {
    fetchUserStats();
    fetchUsers();
  }, [currentPage, searchQuery, roleFilter, sortField, sortDirection, itemsPerPage]);
  
  // ユーザー一覧を取得
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        role: roleFilter,
        sort: `${sortDirection === 'desc' ? '-' : ''}${sortField}`
      });
      
      setUsers(response.users);
      setTotalPages(response.pagination.pages);
      setTotalUsers(response.pagination.total);
      setError(null);
    } catch (err) {
      setError('ユーザー一覧の取得に失敗しました: ' + (err.message || '不明なエラー'));
      console.error('ユーザー取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // ユーザー統計情報を取得
  const fetchUserStats = async () => {
    try {
      const stats = await userService.getUserStats();
      setUserStats(stats);
    } catch (err) {
      console.error('ユーザー統計取得エラー:', err);
    }
  };
  
  // 検索ハンドラ
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // 検索時は1ページ目に戻る
    fetchUsers();
  };
  
  // ソート切り替え
  const handleSort = (field) => {
    if (sortField === field) {
      // 同じフィールドなら方向を切り替え
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 違うフィールドなら降順で開始
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // ユーザー削除ダイアログを表示
  const confirmDelete = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };
  
  // ユーザー削除実行
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await userService.deleteUser(selectedUser._id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers(); // 一覧を再取得
      fetchUserStats(); // 統計も更新
    } catch (err) {
      setError('ユーザーの削除に失敗しました: ' + (err.message || '不明なエラー'));
      console.error('ユーザー削除エラー:', err);
    }
  };
  
  // ユーザー一時停止処理
  const handleSuspendUser = async (userId, currentStatus) => {
    setSuspendLoading(prev => ({ ...prev, [userId]: true }));
    
    try {
      await userService.suspendUser(userId, currentStatus !== 'suspended');
      // 成功メッセージ表示
      setError(null);
      fetchUsers();
    } catch (error) {
      console.error('ユーザー一時停止エラー:', error);
      setError('ユーザーの一時停止に失敗しました');
    } finally {
      setSuspendLoading(prev => ({ ...prev, [userId]: false }));
    }
  };
  
  // APIアクセス切り替え処理
  const handleToggleApiAccess = async (userId, currentState) => {
    setApiToggleLoading(prev => ({...prev, [userId]: true}));
    try {
      await userService.toggleApiAccess(userId, !currentState);
      // ユーザーリストを更新して変更を反映
      setUsers(users.map(user => {
        if (user._id === userId) {
          return {
            ...user,
            apiAccess: {
              ...user.apiAccess,
              enabled: !currentState
            }
          };
        }
        return user;
      }));
    } catch (err) {
      setError('APIアクセス設定の変更に失敗しました: ' + (err.message || '不明なエラー'));
      console.error('APIアクセス設定エラー:', err);
    } finally {
      setApiToggleLoading(prev => ({...prev, [userId]: false}));
    }
  };
  
  // ページネーションアイテムを生成
  const renderPaginationItems = () => {
    const items = [];
    
    // 最初のページへのリンク
    items.push(
      <Pagination.First 
        key="first" 
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(1)}
      />
    );
    
    // 前のページへのリンク
    items.push(
      <Pagination.Prev 
        key="prev" 
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
      />
    );
    
    // ページ番号
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let page = startPage; page <= endPage; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </Pagination.Item>
      );
    }
    
    // 次のページへのリンク
    items.push(
      <Pagination.Next
        key="next"
        disabled={currentPage === totalPages}
        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
      />
    );
    
    // 最後のページへのリンク
    items.push(
      <Pagination.Last
        key="last"
        disabled={currentPage === totalPages}
        onClick={() => setCurrentPage(totalPages)}
      />
    );
    
    return items;
  };
  
  // ソートアイコンを表示
  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <FaSort className="text-muted ml-1" />;
    }
    return sortDirection === 'asc' ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />;
  };
  
  // ユーザー役割のラベルを表示
  const renderRoleLabel = (role) => {
    switch(role) {
      case 'admin':
        return <span className="badge bg-danger"><FaUserShield /> 管理者</span>;
      case 'unsubscribe':
        return <span className="badge bg-secondary"><FaBan /> 利用停止ユーザー</span>;
      default:
        return <span className="badge bg-primary"><FaUserCog /> 一般ユーザー</span>;
    }
  };
  
  // 統計カードを表示
  const renderStatsCards = () => {
    if (!userStats) return null;
    
    return (
      <div className="user-stats row mb-4">
        <div className="col-md-4 mb-3">
          <Card className="h-100">
            <Card.Body>
              <h5>ユーザー統計</h5>
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  <h2>{userStats.totalUsers}</h2>
                  <div className="text-muted">総ユーザー数</div>
                </div>
                <div className="text-info">
                  <i className="bi bi-people-fill fs-1"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        <div className="col-md-4 mb-3">
          <Card className="h-100">
            <Card.Body>
              <h5>ユーザー内訳</h5>
              <div className="mt-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>管理者</span>
                  <span className="badge bg-danger">{userStats.adminCount}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>一般ユーザー</span>
                  <span className="badge bg-primary">{userStats.userCount}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>利用停止ユーザー</span>
                  <span className="badge bg-secondary">{userStats.unsubscribeCount || 0}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>アクティブユーザー</span>
                  <span className="badge bg-success">{userStats.activeUsers}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        <div className="col-md-4 mb-3">
          <Card className="h-100">
            <Card.Body>
              <h5>最近の活動</h5>
              <div className="mt-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>新規ユーザー (30日)</span>
                  <span className="badge bg-info">{userStats.newUsers}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>最近のログイン (7日)</span>
                  <span className="badge bg-warning">{userStats.recentLogins}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    );
  };
  
  return (
    <div className="user-list-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>ユーザー管理</h2>
        <Button variant="primary" onClick={() => navigate('/users/new')}>
          <FaPlus /> 新規ユーザー
        </Button>
      </div>
      
      {/* 統計カード */}
      {renderStatsCards()}
      
      {/* 検索・フィルタリング */}
      <div className="mb-4">
        <Form onSubmit={handleSearch}>
          <div className="row">
            <div className="col-md-6 mb-2">
              <InputGroup>
                <Form.Control
                  placeholder="ユーザー名・メールで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button variant="outline-secondary" type="submit">
                  <FaSearch /> 検索
                </Button>
              </InputGroup>
            </div>
            
            <div className="col-md-3 mb-2">
              <Form.Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">すべての役割</option>
                <option value="admin">管理者</option>
                <option value="user">一般ユーザー</option>
                <option value="unsubscribe">利用停止ユーザー</option>
              </Form.Select>
            </div>
            
            <div className="col-md-3 mb-2">
              <Form.Select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="5">5件表示</option>
                <option value="10">10件表示</option>
                <option value="25">25件表示</option>
                <option value="50">50件表示</option>
              </Form.Select>
            </div>
          </div>
        </Form>
      </div>
      
      {/* エラーメッセージ */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {/* ユーザー一覧テーブル */}
      <div className="table-responsive">
        <Table striped hover className="user-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="sortable">
                ユーザー名 {renderSortIcon('name')}
              </th>
              <th onClick={() => handleSort('email')} className="sortable">
                メールアドレス {renderSortIcon('email')}
              </th>
              <th onClick={() => handleSort('role')} className="sortable">
                役割 {renderSortIcon('role')}
              </th>
              <th onClick={() => handleSort('createdAt')} className="sortable">
                登録日 {renderSortIcon('createdAt')}
              </th>
              <th onClick={() => handleSort('lastLogin')} className="sortable">
                最終ログイン {renderSortIcon('lastLogin')}
              </th>
              <th onClick={() => handleSort('isActive')} className="sortable">
                ステータス {renderSortIcon('isActive')}
              </th>
              <th onClick={() => handleSort('apiAccess.enabled')} className="sortable">
                API利用 {renderSortIcon('apiAccess.enabled')}
              </th>
              <th className="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">読み込み中...</span>
                  </Spinner>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{renderRoleLabel(user.role)}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    {user.lastLogin 
                      ? new Date(user.lastLogin).toLocaleDateString() 
                      : '未ログイン'}
                  </td>
                  <td>
                    {user.isActive 
                      ? <span className="badge bg-success">有効</span>
                      : <span className="badge bg-secondary">無効</span>}
                  </td>
                  <td>
                    {user.role === 'unsubscribe' ? (
                      <span className="badge bg-secondary">利用不可</span>
                    ) : (
                      <div className="d-flex align-items-center">
                        <span className={`badge ${user.apiAccess?.enabled ? 'bg-success' : 'bg-danger'} me-2`}>
                          {user.apiAccess?.enabled ? '利用可' : '無効'}
                        </span>
                        <Button
                          variant={user.apiAccess?.enabled ? 'outline-danger' : 'outline-success'}
                          size="sm"
                          disabled={apiToggleLoading[user._id]}
                          onClick={() => handleToggleApiAccess(user._id, user.apiAccess?.enabled)}
                        >
                          {apiToggleLoading[user._id] ? (
                            <Spinner animation="border" size="sm" />
                          ) : user.apiAccess?.enabled ? (
                            <FaToggleOff title="APIアクセスを無効化" />
                          ) : (
                            <FaToggleOn title="APIアクセスを有効化" />
                          )}
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="btn-group">
                      <Button 
                        variant="outline-info" 
                        size="sm"
                        as={Link} 
                        to={`/users/${user._id}`}
                      >
                        <FaEdit /> 編集
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => confirmDelete(user)}
                      >
                        <FaTrash /> 削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
      
      {/* ページネーション */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          全 {totalUsers} 件中 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalUsers)} 件目を表示
        </div>
        <Pagination>{renderPaginationItems()}</Pagination>
      </div>
      
      {/* 削除確認モーダル */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>ユーザー削除の確認</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <p>
              ユーザー「<strong>{selectedUser.name}</strong>」を削除してもよろしいですか？
              <br />
              この操作は取り消せません。
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={handleDeleteUser}>
            削除する
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserList;