import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './SimpleDashboard.css';
import { getSimpleOrganizations } from '../../services/simple/simpleOrganization.service';
import { getCurrentUser } from '../../services/simple/simpleAuth.service';

const SimpleDashboard = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 現在のユーザー情報を取得
    const fetchUserData = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData.data.user);
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました');
      }
    };

    // 組織一覧を取得
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const response = await getSimpleOrganizations();
        setOrganizations(response.data);
        setLoading(false);
      } catch (err) {
        console.error('組織一覧取得エラー:', err);
        setError('組織一覧の取得に失敗しました');
        setLoading(false);
      }
    };

    fetchUserData();
    fetchOrganizations();
  }, []);

  // ユーザーがSuperAdminまたはAdminの場合のみ新規組織作成ボタンを表示
  const canCreateOrganization = user && (user.role === 'SuperAdmin' || user.role === 'Admin');

  return (
    <div className="simple-dashboard">
      <div className="simple-dashboard-header">
        <h1>シンプル版ダッシュボード</h1>
        {canCreateOrganization && (
          <Link to="/simple/organizations/new" className="simple-button primary">
            新規組織作成
          </Link>
        )}
      </div>

      {loading ? (
        <div className="simple-loading">読み込み中...</div>
      ) : error ? (
        <div className="simple-error">{error}</div>
      ) : (
        <div className="simple-organization-list">
          <h2>組織一覧</h2>
          {organizations.length === 0 ? (
            <div className="simple-empty-state">
              <p>組織が見つかりません</p>
              {canCreateOrganization && (
                <Link to="/simple/organizations/new" className="simple-button secondary">
                  新規組織を作成する
                </Link>
              )}
            </div>
          ) : (
            <div className="simple-cards">
              {organizations.map(org => (
                <div key={org._id} className="simple-card">
                  <h3>{org.name}</h3>
                  <p>{org.description || '説明なし'}</p>
                  <p>ワークスペース: {org.workspaceName}</p>
                  <div className="simple-card-footer">
                    <Link to={`/simple/organizations/${org._id}`} className="simple-button secondary">
                      詳細を見る
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleDashboard;