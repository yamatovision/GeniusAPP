/**
 * ユーザーモデルの単体テスト
 */
import { User } from '../../../src/db/models';
import { createTestUser, createTestOrganization } from '../../utils/db-test-helper';

describe('Userモデル', () => {
  let organizationId: string;
  
  beforeAll(async () => {
    const organization = await createTestOrganization();
    organizationId = organization._id.toString();
  });
  
  it('有効なデータでユーザーを作成できる', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'テストユーザー',
      role: 'user',
      organizationId,
    };
    
    const user = new User(userData);
    await user.save();
    
    expect(user._id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.role).toBe(userData.role);
    expect(user.organizationId.toString()).toBe(userData.organizationId);
    expect(user.password).not.toBe(userData.password); // パスワードはハッシュ化されている
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });
  
  it('重複したメールアドレスでユーザーを作成できない', async () => {
    // 最初のユーザーを作成
    await createTestUser('duplicate@example.com', 'password123', 'User1', organizationId);
    
    // 同じメールアドレスで2つ目のユーザーを作成しようとする
    const duplicateUser = new User({
      email: 'duplicate@example.com',
      password: 'anotherpassword',
      name: 'User2',
      role: 'user',
      organizationId,
    });
    
    await expect(duplicateUser.save()).rejects.toThrow();
  });
  
  it('必須フィールドが欠けている場合エラーになる', async () => {
    // メールアドレスなしで作成
    const userNoEmail = new User({
      password: 'password123',
      name: 'No Email User',
      role: 'user',
      organizationId,
    });
    
    await expect(userNoEmail.save()).rejects.toThrow();
    
    // パスワードなしで作成
    const userNoPassword = new User({
      email: 'nopassword@example.com',
      name: 'No Password User',
      role: 'user',
      organizationId,
    });
    
    await expect(userNoPassword.save()).rejects.toThrow();
    
    // 名前なしで作成
    const userNoName = new User({
      email: 'noname@example.com',
      password: 'password123',
      role: 'user',
      organizationId,
    });
    
    await expect(userNoName.save()).rejects.toThrow();
    
    // 組織IDなしで作成
    const userNoOrg = new User({
      email: 'noorg@example.com',
      password: 'password123',
      name: 'No Org User',
      role: 'user',
    });
    
    await expect(userNoOrg.save()).rejects.toThrow();
  });
  
  it('パスワード比較が正しく機能する', async () => {
    const plainPassword = 'password123';
    const user = await createTestUser('compare@example.com', plainPassword);
    
    // 正しいパスワード
    const isMatchCorrect = await user.comparePassword(plainPassword);
    expect(isMatchCorrect).toBe(true);
    
    // 誤ったパスワード
    const isMatchWrong = await user.comparePassword('wrongpassword');
    expect(isMatchWrong).toBe(false);
  });
  
  it('メールアドレスによるユーザー検索が機能する', async () => {
    const email = 'findbyemail@example.com';
    await createTestUser(email);
    
    const foundUser = await User.findByEmail(email);
    expect(foundUser).toBeDefined();
    expect(foundUser?.email).toBe(email);
    expect(foundUser?.password).toBeDefined(); // パスワードフィールドが含まれている
  });
});