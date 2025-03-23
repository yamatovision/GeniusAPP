const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../portal/backend/app');
const OrganizationModel = require('../../portal/backend/models/organization.model');
const UserModel = require('../../portal/backend/models/user.model');
const jwt = require('jsonwebtoken');
const config = require('../../portal/backend/config/auth.config');

// テスト用データ
let adminToken;
let userToken;
let adminUser;
let regularUser;
let testOrganization;

// セットアップ関数: テストユーザーとトークンを作成
const setupTestData = async () => {
  try {
    // 管理者ユーザーの作成
    adminUser = await UserModel.create({
      username: 'org_admin_test',
      email: 'org_admin@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi', // "testpassword"
      role: 'admin',
      isActive: true,
      organizationIds: []
    });

    // 一般ユーザーの作成
    regularUser = await UserModel.create({
      username: 'org_user_test',
      email: 'org_user@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi', // "testpassword"
      role: 'user',
      isActive: true,
      organizationIds: []
    });

    // トークンの作成
    adminToken = jwt.sign(
      { id: adminUser._id, role: 'admin' },
      config.secret,
      { expiresIn: '24h' }
    );

    userToken = jwt.sign(
      { id: regularUser._id, role: 'user' },
      config.secret,
      { expiresIn: '24h' }
    );

    // テスト組織の作成
    testOrganization = await OrganizationModel.create({
      name: 'Organization Management Test Org',
      anthropicOrgId: 'org_mgmt_test_123',
      adminUserId: adminUser._id,
      members: [
        { userId: adminUser._id, role: 'admin', email: 'org_admin@example.com' }
      ],
      settings: {
        usageLimit: 1000000,
        alertThreshold: 80
      }
    });

    // 管理者ユーザーの組織IDを更新
    await UserModel.findByIdAndUpdate(
      adminUser._id,
      { $addToSet: { organizationIds: testOrganization._id } }
    );

  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
};

// テスト開始前のセットアップ
beforeAll(async () => {
  // MongoDB接続
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/appgenius_test';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // テストデータの作成
  await setupTestData();
});

// テスト終了後のクリーンアップ
afterAll(async () => {
  // テストデータの削除
  await UserModel.deleteMany({ email: { $in: ['org_admin@example.com', 'org_user@example.com'] } });
  await OrganizationModel.deleteMany({ anthropicOrgId: 'org_mgmt_test_123' });

  // MongoDB接続を閉じる
  await mongoose.connection.close();
});

// 組織管理機能のテスト
describe('Organization Management Tests', () => {
  // 組織作成テスト
  it('should create a new organization', async () => {
    const newOrgData = {
      name: 'New Test Organization',
      anthropicOrgId: 'org_new_test_123',
      settings: {
        usageLimit: 500000,
        alertThreshold: 75
      }
    };

    const response = await request(app)
      .post('/api/organizations')
      .set('x-access-token', adminToken)
      .send(newOrgData);

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('name', newOrgData.name);
    expect(response.body).toHaveProperty('anthropicOrgId', newOrgData.anthropicOrgId);
    expect(response.body).toHaveProperty('adminUserId', adminUser._id.toString());
    expect(response.body.settings).toHaveProperty('usageLimit', newOrgData.settings.usageLimit);

    // 作成した組織をクリーンアップ
    await OrganizationModel.findOneAndDelete({ anthropicOrgId: newOrgData.anthropicOrgId });
  });

  // 権限チェックテスト - 一般ユーザーは組織作成できない
  it('should not allow regular users to create organizations', async () => {
    const newOrgData = {
      name: 'Unauthorized Org',
      anthropicOrgId: 'org_unauth_123',
      settings: {
        usageLimit: 500000,
        alertThreshold: 75
      }
    };

    const response = await request(app)
      .post('/api/organizations')
      .set('x-access-token', userToken)
      .send(newOrgData);

    expect(response.statusCode).toBe(403);
  });

  // メンバーの組織取得テスト
  it('should get organizations for a member', async () => {
    // まず一般ユーザーをメンバーとして組織に追加
    await OrganizationModel.findByIdAndUpdate(
      testOrganization._id,
      {
        $push: {
          members: {
            userId: regularUser._id,
            role: 'user',
            email: 'org_user@example.com'
          }
        }
      }
    );

    // ユーザーの組織IDsを更新
    await UserModel.findByIdAndUpdate(
      regularUser._id,
      { $addToSet: { organizationIds: testOrganization._id } }
    );

    // ユーザートークンで組織一覧を取得
    const response = await request(app)
      .get('/api/organizations')
      .set('x-access-token', userToken);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0]._id).toBe(testOrganization._id.toString());
  });

  // 組織詳細取得の権限チェックテスト
  it('should verify permissions for organization details access', async () => {
    // 組織メンバーは組織詳細を取得できる
    const memberResponse = await request(app)
      .get(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', userToken);

    expect(memberResponse.statusCode).toBe(200);
    expect(memberResponse.body._id).toBe(testOrganization._id.toString());

    // 新しい非メンバーユーザーを作成
    const nonMemberUser = await UserModel.create({
      username: 'non_member_test',
      email: 'non_member@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'user',
      isActive: true
    });

    const nonMemberToken = jwt.sign(
      { id: nonMemberUser._id, role: 'user' },
      config.secret,
      { expiresIn: '24h' }
    );

    // 非メンバーユーザーは組織詳細にアクセスできない
    const nonMemberResponse = await request(app)
      .get(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', nonMemberToken);

    expect(nonMemberResponse.statusCode).toBe(403);

    // 非メンバーユーザーを削除
    await UserModel.findByIdAndDelete(nonMemberUser._id);
  });

  // メンバー管理テスト
  it('should manage organization members properly', async () => {
    // 新しいメンバー用ユーザーを作成
    const newMemberUser = await UserModel.create({
      username: 'new_org_member',
      email: 'new_org_member@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'user',
      isActive: true
    });

    // 管理者がメンバーを追加
    const addMemberResponse = await request(app)
      .post(`/api/organizations/${testOrganization._id}/members`)
      .set('x-access-token', adminToken)
      .send({
        userId: newMemberUser._id,
        role: 'developer',
        email: 'new_org_member@example.com'
      });

    expect(addMemberResponse.statusCode).toBe(200);
    expect(addMemberResponse.body.members).toContainEqual(
      expect.objectContaining({
        userId: newMemberUser._id.toString(),
        role: 'developer',
        email: 'new_org_member@example.com'
      })
    );

    // ユーザーが組織のメンバー一覧に追加されたことを確認
    const updatedUser = await UserModel.findById(newMemberUser._id);
    expect(updatedUser.organizationIds).toContain(testOrganization._id.toString());

    // 一般ユーザーはメンバーを追加できない
    const unauthorizedAddResponse = await request(app)
      .post(`/api/organizations/${testOrganization._id}/members`)
      .set('x-access-token', userToken)
      .send({
        userId: mongoose.Types.ObjectId(),
        role: 'user',
        email: 'another_user@example.com'
      });

    expect(unauthorizedAddResponse.statusCode).toBe(403);

    // 管理者がメンバーを削除
    const removeMemberResponse = await request(app)
      .delete(`/api/organizations/${testOrganization._id}/members/${newMemberUser._id}`)
      .set('x-access-token', adminToken);

    expect(removeMemberResponse.statusCode).toBe(200);
    expect(removeMemberResponse.body.members).not.toContainEqual(
      expect.objectContaining({
        userId: newMemberUser._id.toString()
      })
    );

    // ユーザーが更新されて組織IDが削除されたことを確認
    const userAfterRemoval = await UserModel.findById(newMemberUser._id);
    expect(userAfterRemoval.organizationIds).not.toContain(testOrganization._id.toString());

    // テスト後にユーザーを削除
    await UserModel.findByIdAndDelete(newMemberUser._id);
  });

  // 組織設定更新テスト
  it('should update organization settings', async () => {
    const updatedSettings = {
      name: 'Updated Organization Name',
      settings: {
        usageLimit: 1500000,
        alertThreshold: 85
      }
    };

    // 管理者が組織設定を更新
    const updateResponse = await request(app)
      .put(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', adminToken)
      .send(updatedSettings);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body).toHaveProperty('name', updatedSettings.name);
    expect(updateResponse.body.settings).toHaveProperty('usageLimit', updatedSettings.settings.usageLimit);
    expect(updateResponse.body.settings).toHaveProperty('alertThreshold', updatedSettings.settings.alertThreshold);

    // 一般ユーザーは組織設定を更新できない
    const unauthorizedUpdateResponse = await request(app)
      .put(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', userToken)
      .send({
        name: 'Unauthorized Update'
      });

    expect(unauthorizedUpdateResponse.statusCode).toBe(403);

    // 元の設定に戻す
    await OrganizationModel.findByIdAndUpdate(
      testOrganization._id,
      {
        name: 'Organization Management Test Org',
        settings: {
          usageLimit: 1000000,
          alertThreshold: 80
        }
      }
    );
  });

  // 組織削除テスト
  it('should delete an organization', async () => {
    // 削除用のテスト組織を作成
    const tempOrganization = await OrganizationModel.create({
      name: 'Temporary Organization',
      anthropicOrgId: 'org_temp_delete_123',
      adminUserId: adminUser._id,
      members: [
        { userId: adminUser._id, role: 'admin', email: 'org_admin@example.com' },
        { userId: regularUser._id, role: 'user', email: 'org_user@example.com' }
      ]
    });

    // ユーザーの組織IDを更新
    await UserModel.updateMany(
      { _id: { $in: [adminUser._id, regularUser._id] } },
      { $addToSet: { organizationIds: tempOrganization._id } }
    );

    // 一般ユーザーは組織を削除できない
    const unauthorizedDeleteResponse = await request(app)
      .delete(`/api/organizations/${tempOrganization._id}`)
      .set('x-access-token', userToken);

    expect(unauthorizedDeleteResponse.statusCode).toBe(403);

    // 管理者が組織を削除
    const deleteResponse = await request(app)
      .delete(`/api/organizations/${tempOrganization._id}`)
      .set('x-access-token', adminToken);

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body).toHaveProperty('message', 'Organization deleted successfully');

    // 組織が実際に削除されたことを確認
    const deletedOrg = await OrganizationModel.findById(tempOrganization._id);
    expect(deletedOrg).toBeNull();

    // ユーザーの組織IDsから削除されたことを確認
    const updatedAdminUser = await UserModel.findById(adminUser._id);
    const updatedRegularUser = await UserModel.findById(regularUser._id);
    expect(updatedAdminUser.organizationIds).not.toContain(tempOrganization._id.toString());
    expect(updatedRegularUser.organizationIds).not.toContain(tempOrganization._id.toString());
  });
});