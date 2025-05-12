import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import './dashboard-user.css';
import { getCurrentUser } from '../../services/simple/simpleAuth.service';
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  updateUserRole 
} from '../../services/simple/simpleUser.service';

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  
  // ユーザー追加用の状態
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'User'
  });
  
  // ユーザー編集用の状態
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  
  // ユーザー削除用の状態
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);

  // コンポーネントマウント時に現在のユーザーとユーザー一覧を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 現在のユーザー情報を取得
        const currentUser = await getCurrentUser();
        if (currentUser && currentUser.data && currentUser.data.user) {
          setUser(currentUser.data.user);
        }
        
        // ユーザー一覧を取得
        const usersResponse = await getUsers();
        if (usersResponse && usersResponse.data) {
          setUsers(usersResponse.data);
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // ユーザー追加ダイアログの開閉
  const handleOpenAddDialog = () => {
    setNewUser({
      name: '',
      email: '',
      password: '',
      role: 'User'
    });
    setOpenAddDialog(true);
  };
  
  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
  };

  // 新規ユーザー情報の変更ハンドラ
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser({
      ...newUser,
      [name]: value
    });
  };

  // ユーザー追加処理
  const handleAddUser = async () => {
    try {
      setLoading(true);
      
      // 必須フィールドの検証
      if (!newUser.name || !newUser.email || !newUser.password) {
        setError('名前、メールアドレス、パスワードは必須です');
        setLoading(false);
        return;
      }
      
      // パスワードの長さ検証
      if (newUser.password.length < 8) {
        setError('パスワードは8文字以上である必要があります');
        setLoading(false);
        return;
      }
      
      // メールアドレスの形式検証
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email)) {
        setError('有効なメールアドレスを入力してください');
        setLoading(false);
        return;
      }
      
      // ユーザー追加APIの呼び出し
      const response = await createUser(
        newUser.name,
        newUser.email,
        newUser.password,
        newUser.role,
        user.organizationId || null
      );
      
      if (response && response.success) {
        // ユーザー一覧を更新
        const updatedUsersResponse = await getUsers();
        if (updatedUsersResponse && updatedUsersResponse.data) {
          setUsers(updatedUsersResponse.data);
        }
        
        // ダイアログを閉じてフォームをリセット
        setOpenAddDialog(false);
        setNewUser({
          name: '',
          email: '',
          password: '',
          role: 'User'
        });
        setError('');
      } else {
        setError(response?.message || 'ユーザーの追加に失敗しました');
      }
    } catch (err) {
      console.error('ユーザー追加エラー:', err);
      setError(err?.message || 'ユーザーの追加中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ユーザー編集ダイアログの開閉
  const handleOpenEditDialog = (userData) => {
    setEditUser({
      ...userData,
      password: ''
    });
    setShowPasswordField(false);
    setOpenEditDialog(true);
  };
  
  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditUser(null);
  };

  // 編集ユーザー情報の変更ハンドラ
  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUser({
      ...editUser,
      [name]: value
    });
  };

  // ユーザー編集処理
  const handleUpdateUser = async () => {
    try {
      setLoading(true);
      
      // 必須フィールドの検証
      if (!editUser.name || !editUser.email) {
        setError('名前とメールアドレスは必須です');
        setLoading(false);
        return;
      }
      
      // メールアドレスの形式検証
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editUser.email)) {
        setError('有効なメールアドレスを入力してください');
        setLoading(false);
        return;
      }
      
      // パスワードが入力されている場合は長さ検証
      if (showPasswordField && editUser.password) {
        if (editUser.password.length < 8) {
          setError('パスワードは8文字以上である必要があります');
          setLoading(false);
          return;
        }
      }
      
      // パスワードが入力されていない場合はnullにする
      const passwordToUpdate = showPasswordField && editUser.password ? editUser.password : null;
      
      // ユーザー更新APIの呼び出し
      const response = await updateUser(
        editUser._id,
        editUser.name,
        editUser.email,
        passwordToUpdate,
        null  // APIキーIDは使用しない
      );
      
      if (response && response.success) {
        // ユーザー一覧を更新
        const updatedUsersResponse = await getUsers();
        if (updatedUsersResponse && updatedUsersResponse.data) {
          setUsers(updatedUsersResponse.data);
        }
        
        // ダイアログを閉じる
        setOpenEditDialog(false);
        setEditUser(null);
        setError('');
      } else {
        setError(response?.message || 'ユーザーの更新に失敗しました');
      }
    } catch (err) {
      console.error('ユーザー更新エラー:', err);
      setError(err?.message || 'ユーザーの更新中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ユーザー削除ダイアログの開閉
  const handleOpenDeleteDialog = (userId) => {
    // アクティブな要素があれば、フォーカスを解除して、aria-hidden問題を回避
    if (document.activeElement) {
      document.activeElement.blur();
    }
    // requestAnimationFrameを使用して、DOMの更新を待ってからダイアログを開く
    requestAnimationFrame(() => {
      setDeleteUserId(userId);
      setOpenDeleteDialog(true);
    });
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setDeleteUserId(null);
  };

  // ユーザー削除処理
  const handleDeleteUser = async () => {
    try {
      setLoading(true);
      setError(''); // エラーメッセージをクリア

      if (!deleteUserId) {
        setError('削除するユーザーが指定されていません');
        setLoading(false);
        return;
      }

      // ユーザー自身を削除しようとした場合
      if (deleteUserId === user?._id) {
        setError('自分自身を削除することはできません');
        setLoading(false);
        setOpenDeleteDialog(false);
        return;
      }

      console.log(`ユーザー削除開始: ID ${deleteUserId}`);

      // ユーザー削除APIの呼び出し
      const response = await deleteUser(deleteUserId);

      console.log('ユーザー削除レスポンス:', response);

      if (response && response.success) {
        // ダイアログを閉じる
        setOpenDeleteDialog(false);
        setDeleteUserId(null);

        // 成功メッセージを表示
        setError('');

        // 少し待ってからユーザー一覧を更新（レース状態回避）
        setTimeout(async () => {
          try {
            console.log('削除前のユーザー一覧:', users.map(u => ({ id: u._id, name: u.name })));
            console.log(`削除対象ユーザーID: ${deleteUserId}`);

            const updatedUsersResponse = await getUsers();
            console.log('API応答:', updatedUsersResponse);

            if (updatedUsersResponse && updatedUsersResponse.data) {
              // 削除されたユーザーが含まれていないか確認
              const deletedUserStillExists = updatedUsersResponse.data.some(u => u._id === deleteUserId);
              console.log(`削除されたユーザーがまだ存在: ${deletedUserStillExists}`);

              // 強制的にフィルタリングして削除ユーザーを除外
              const filteredUsers = updatedUsersResponse.data.filter(u => u._id !== deleteUserId);
              console.log('フィルタリング後のユーザー数:', filteredUsers.length);

              // フィルタリングしたユーザーリストを設定
              setUsers(filteredUsers);
              console.log('ユーザー一覧を更新しました');
            }
          } catch (refreshErr) {
            console.error('ユーザー一覧更新エラー:', refreshErr);
          }
        }, 1000);
      } else {
        console.error('削除API呼び出しエラー:', response);
        setError(response?.message || 'ユーザーの削除に失敗しました');
        setOpenDeleteDialog(false);
      }
    } catch (err) {
      console.error('ユーザー削除エラー:', err);
      setError(err?.message || 'ユーザーの削除中にエラーが発生しました');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  // ユーザーの役割変更処理
  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      
      // 組織IDの取得
      const organizationId = user?.organizationId;
      
      // 役割更新APIの呼び出し
      const response = await updateUserRole(organizationId, userId, newRole);
      
      if (response && response.success) {
        // ユーザー一覧を更新
        const updatedUsersResponse = await getUsers();
        if (updatedUsersResponse && updatedUsersResponse.data) {
          setUsers(updatedUsersResponse.data);
        }
        setError('');
      } else {
        setError(response?.message || 'ユーザーの役割更新に失敗しました');
      }
    } catch (err) {
      console.error('役割更新エラー:', err);
      setError(err?.message || 'ユーザーの役割更新中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 権限判定ヘルパー
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  // ローディング表示
  if (loading && !user) {
    return (
      <Container>
        <Box my={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            ユーザー管理
          </Typography>
          
          {isAdmin && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenAddDialog}
            >
              ユーザー追加
            </Button>
          )}
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box mb={2}>
            <Typography variant="h5" component="h2" gutterBottom>
              ユーザー一覧
            </Typography>
          </Box>
          
          {users.length === 0 ? (
            <Typography variant="body1">
              ユーザーが見つかりません
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>名前</TableCell>
                    <TableCell>メールアドレス</TableCell>
                    <TableCell>役割</TableCell>
                    <TableCell>ClaudeCode起動回数</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((userData) => (
                    <TableRow key={userData._id}>
                      <TableCell>{userData.name}</TableCell>
                      <TableCell>{userData.email}</TableCell>
                      <TableCell>
                        {userData._id === user?._id ? (
                          // 自分自身の場合は役割を編集不可
                          userData.role === 'SuperAdmin' ? 'スーパー管理者' : 
                          userData.role === 'Admin' ? '管理者' : 'ユーザー'
                        ) : (
                          // 他のユーザーの場合は権限があれば役割を編集可能
                          isAdmin ? (
                            <FormControl variant="outlined" size="small" fullWidth>
                              <Select
                                value={userData.role}
                                onChange={(e) => handleRoleChange(userData._id, e.target.value)}
                                disabled={!isSuperAdmin && userData.role === 'SuperAdmin'}
                              >
                                <MenuItem value="User">ユーザー</MenuItem>
                                <MenuItem value="Admin">管理者</MenuItem>
                                {isSuperAdmin && (
                                  <MenuItem value="SuperAdmin">スーパー管理者</MenuItem>
                                )}
                              </Select>
                            </FormControl>
                          ) : (
                            userData.role === 'SuperAdmin' ? 'スーパー管理者' : 
                            userData.role === 'Admin' ? '管理者' : 'ユーザー'
                          )
                        )}
                      </TableCell>
                      <TableCell>{userData.claudeCodeLaunchCount || 0}</TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenEditDialog(userData)}
                          >
                            編集
                          </Button>
                          
                          {isAdmin && userData._id !== user?._id && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleOpenDeleteDialog(userData._id)}
                            >
                              削除
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
      
      {/* ユーザー追加ダイアログ */}
      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle>新規ユーザー追加</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              autoFocus
              margin="dense"
              id="name"
              name="name"
              label="名前"
              type="text"
              fullWidth
              variant="outlined"
              value={newUser.name}
              onChange={handleNewUserChange}
              required
            />
            <TextField
              margin="dense"
              id="email"
              name="email"
              label="メールアドレス"
              type="email"
              fullWidth
              variant="outlined"
              value={newUser.email}
              onChange={handleNewUserChange}
              required
            />
            <TextField
              margin="dense"
              id="password"
              name="password"
              label="パスワード (8文字以上)"
              type="password"
              fullWidth
              variant="outlined"
              value={newUser.password}
              onChange={handleNewUserChange}
              required
              helperText="8文字以上のパスワードを設定してください"
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="role-label">役割</InputLabel>
              <Select
                labelId="role-label"
                id="role"
                name="role"
                value={newUser.role}
                onChange={handleNewUserChange}
                label="役割"
              >
                <MenuItem value="User">ユーザー</MenuItem>
                <MenuItem value="Admin">管理者</MenuItem>
                {isSuperAdmin && (
                  <MenuItem value="SuperAdmin">スーパー管理者</MenuItem>
                )}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseAddDialog} color="primary">
            キャンセル
          </Button>
          <Button onClick={handleAddUser} color="primary" variant="contained" disabled={loading}>
            {loading ? '処理中...' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* ユーザー編集ダイアログ */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>ユーザー情報編集</DialogTitle>
        <DialogContent>
          {editUser && (
            <Box mt={2}>
              <TextField
                autoFocus
                margin="dense"
                id="edit-name"
                name="name"
                label="名前"
                type="text"
                fullWidth
                variant="outlined"
                value={editUser.name}
                onChange={handleEditUserChange}
                required
              />
              <TextField
                margin="dense"
                id="edit-email"
                name="email"
                label="メールアドレス"
                type="email"
                fullWidth
                variant="outlined"
                value={editUser.email}
                onChange={handleEditUserChange}
                required
              />
              
              <Box mt={2} mb={1}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => setShowPasswordField(!showPasswordField)}
                >
                  {showPasswordField ? 'パスワード変更をキャンセル' : 'パスワードを変更'}
                </Button>
              </Box>
              
              {showPasswordField && (
                <TextField
                  margin="dense"
                  id="edit-password"
                  name="password"
                  label="新しいパスワード (8文字以上)"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={editUser.password}
                  onChange={handleEditUserChange}
                  helperText="変更する場合のみ入力してください"
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseEditDialog} color="primary">
            キャンセル
          </Button>
          <Button onClick={handleUpdateUser} color="primary" variant="contained" disabled={loading}>
            {loading ? '処理中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* ユーザー削除確認ダイアログ */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        disableRestoreFocus
      >
        <DialogTitle id="delete-dialog-title">ユーザー削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            このユーザーを削除してもよろしいですか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDeleteDialog} color="primary" autoFocus>
            キャンセル
          </Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained" disabled={loading}>
            {loading ? '処理中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Dashboard;