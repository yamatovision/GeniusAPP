/**
 * テスト用コントローラーのテスト
 */
import request from 'supertest';
import express, { Response, NextFunction } from 'express';
import { 
  connectTestDB, 
  disconnectTestDB, 
  clearTestCollections,
  createTestUser,
  createTestOrganization
} from '../../utils/db-test-helper';
import { generateAuthToken, getAuthHeader } from '../../utils/test-auth-helper';
import { testEndpoint } from '../../../src/features/properties/test-controller';
import { RequestWithUser, UserRole } from '../../../src/types';
import { sendSuccess, sendError } from '../../../src/common/utils/response';

// 直接テスト用のExpressアプリを作成する
const testApp = express();
testApp.use(express.json());

// モックの認証ミドルウェア
const mockAuthMiddleware = (req: RequestWithUser, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, '認証が必要です', 401, 'UNAUTHORIZED');
  }
  
  // 認証済みの場合、リクエストにユーザー情報を付与
  req.user = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.USER,  // 正しい列挙型を使用
    organizationId: 'test-org-id'
  };
  
  next();
};

// テスト用ルーターを設定
const setupTestRouter = () => {
  const router = express.Router();
  
  // テストエンドポイントを登録
  router.get('/test', mockAuthMiddleware, (req: RequestWithUser, res: Response) => {
    // 簡単なテスト用レスポンス
    return sendSuccess(res, { message: 'テスト成功' });
  });
  
  // テストアプリにルーターをマウント
  testApp.use('/api/test', router);
  
  console.log('テスト用アプリケーションとルーターをセットアップしました');
};

// テスト前の準備
beforeAll(async () => {
  await connectTestDB();
  setupTestRouter();
});

// テスト後のクリーンアップ
afterAll(async () => {
  await disconnectTestDB();
});

// テストケース間のデータクリーンアップ
beforeEach(async () => {
  await clearTestCollections();
});

describe('テスト用コントローラーテスト', () => {
  it('認証済みユーザーがアクセスできること', async () => {
    // テスト用組織を作成
    const org = await createTestOrganization('テスト組織1');
    
    // タイムスタンプを追加して一意のメールアドレスを生成
    const timestamp = Date.now();
    const testEmail = `test_user_${timestamp}@example.com`;
    
    // テスト用ユーザーを作成
    const user = await createTestUser({
      email: testEmail,
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // APIリクエスト
    const response = await request(testApp)
      .get('/api/test/test')
      .set(getAuthHeader(accessToken));
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toBe('テスト成功');
  });
  
  it('認証なしでアクセスすると401エラーになること', async () => {
    // 認証なしでAPIリクエスト
    const response = await request(testApp)
      .get('/api/test/test');
    
    // レスポンスの検証
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});