/**
 * テスト用データベースヘルパー
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Organization, RefreshToken, Property, History } from '../../src/db/models';
import { ZoneType, FireZone, ShadowRegulation, PropertyStatus } from '../../src/types';

// インメモリMongoDBサーバー
let mongoServer: MongoMemoryServer;

/**
 * テスト用DBの接続
 */
export const connectTestDB = async (): Promise<void> => {
  try {
    // 既に接続中なら一旦切断
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // テスト用の接続先を使用（本番環境データを保護するため）
    // 注意: テスト時は必ずテスト用DBを使用する
    const uri = 'mongodb://localhost:27017/hinago-test';
    console.log('テスト接続先:', uri);
    
    // Mongooseの接続
    await mongoose.connect(uri, {
      connectTimeoutMS: 10000,  // タイムアウト時間を短縮
      socketTimeoutMS: 20000,   // タイムアウト時間を短縮
      serverSelectionTimeoutMS: 10000  // タイムアウト時間を短縮
    });
    
    console.log('テスト用データベースに接続しました。状態:', mongoose.connection.readyState);
    // 接続後にDBが存在するかをチェック
    const db = mongoose.connection.db;
    console.log('データベース名:', db.databaseName);
    const collections = await db.listCollections().toArray();
    console.log('コレクション一覧:', collections.map(c => c.name).join(', '));
  } catch (error) {
    console.error('MongoDB接続エラー:', error);
    throw error;
  }
};

/**
 * テスト用DBの切断
 */
export const disconnectTestDB = async (): Promise<void> => {
  try {
    // データベースのクリーンアップとクローズを順番に実行
    if (mongoose.connection.readyState !== 0) {
      try {
        // 本番環境のため、切断のみ行いデータベースはドロップしない
        await mongoose.connection.close();
        console.log('データベース接続を切断しました');
      } catch (closeError) {
        console.error('データベースクローズエラー:', closeError);
      }
    }
    
    console.log('テスト用DBの切断が完了しました');
  } catch (error) {
    console.error('MongoDB切断エラー:', error);
    // エラーをスローせず、できる限りのクリーンアップを試みる
  }
};

/**
 * テスト用DBのクリア
 */
export const clearTestDB = async (): Promise<void> => {
  // テストデータのクリアのためのプレフィックスを設定
  const testPrefix = 'test_';
  
  // テストデータのみを特定して削除
  await User.deleteMany({ email: { $regex: `^${testPrefix}` } });
  await Organization.deleteMany({ name: { $regex: `^${testPrefix}` } });
  await RefreshToken.deleteMany({ token: { $regex: `^${testPrefix}` } });
  await Property.deleteMany({ name: { $regex: `^${testPrefix}` } });
  await History.deleteMany({ description: { $regex: `^${testPrefix}` } });
  
  console.log('テスト用データをクリアしました');
};

/**
 * 特定のコレクションのクリア
 */
export const clearTestCollections = async (): Promise<void> => {
  // テストデータのクリアのためのプレフィックスを設定
  const testPrefix = 'test_';
  
  // テストデータのみを特定して削除
  await User.deleteMany({ email: { $regex: `^${testPrefix}` } });
  await Organization.deleteMany({ name: { $regex: `^${testPrefix}` } });
  await RefreshToken.deleteMany({ token: { $regex: `^${testPrefix}` } });
  await Property.deleteMany({ name: { $regex: `^${testPrefix}` } });
  await History.deleteMany({ description: { $regex: `^${testPrefix}` } });
  
  console.log('テスト用コレクションをクリアしました');
};

/**
 * テスト用の組織データを作成
 */
export const createTestOrganization = async (name = 'テスト組織'): Promise<any> => {
  // テスト用プレフィックスを追加
  const testName = `test_${name}_${Date.now()}`;
  
  return await Organization.create({
    name: testName,
    subscription: 'free',
  });
};

/**
 * テスト用のユーザーデータを作成
 */
export const createTestUser = async (
  userData: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    organizationId?: string;
  } = {}
): Promise<any> => {
  // テスト用プレフィックスとタイムスタンプを追加して重複を避ける
  const timestamp = Date.now();
  
  const { 
    email = `test_user_${timestamp}@example.com`, 
    password = 'password123', 
    name = `test_ユーザー_${timestamp}`,
    role = 'user',
    organizationId 
  } = userData;
  
  // 組織IDがない場合は新規作成
  let orgId = organizationId;
  if (!orgId) {
    const organization = await createTestOrganization();
    orgId = organization._id;
  }
  
  return await User.create({
    email,
    password,
    name,
    role,
    organizationId: orgId,
  });
};

/**
 * テスト用のリフレッシュトークンを作成
 */
export const createTestRefreshToken = async (
  userId: string,
  token = `test_refresh_token_${Date.now()}`,
  expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
): Promise<any> => {
  return await RefreshToken.create({
    userId,
    token,
    expiresAt,
    isRevoked: false,
  });
};

/**
 * テスト用の物件データを作成
 */
export const createTestProperty = async (
  propertyData: {
    name?: string;
    address?: string;
    area?: number;
    zoneType?: ZoneType;
    fireZone?: FireZone;
    buildingCoverage?: number;
    floorAreaRatio?: number;
    shadowRegulation?: ShadowRegulation;
    heightLimit?: number;
    roadWidth?: number;
    price?: number;
    status?: PropertyStatus;
    notes?: string;
    organizationId?: string;
    shapeData?: {
      points: { x: number, y: number }[];
      width?: number;
      depth?: number;
      sourceFile?: string;
    };
  } = {}
): Promise<any> => {
  // テスト用プレフィックスとタイムスタンプを追加
  const timestamp = Date.now();
  
  const { 
    name = `test_物件_${timestamp}`,
    address = `test_福岡市中央区天神1-1-${timestamp % 1000}`,
    area = 500,
    zoneType = ZoneType.CATEGORY8,
    fireZone = FireZone.SEMI_FIRE,
    buildingCoverage = 80,
    floorAreaRatio = 400,
    shadowRegulation = ShadowRegulation.TYPE2,
    heightLimit = 31,
    roadWidth = 8,
    price = 250000000,
    status = PropertyStatus.NEW,
    notes = `test_テスト用物件データ_${timestamp}`,
    organizationId,
    shapeData
  } = propertyData;
  
  // 組織IDがない場合は新規作成
  let orgId = organizationId;
  if (!orgId) {
    const organization = await createTestOrganization();
    orgId = organization._id;
  }
  
  // 許容建築面積を計算
  const allowedBuildingArea = area * (buildingCoverage / 100);
  
  try {
    const property = await Property.create({
      name,
      address,
      area,
      zoneType,
      fireZone,
      shadowRegulation,
      buildingCoverage,
      floorAreaRatio,
      heightLimit,
      roadWidth,
      allowedBuildingArea,
      price,
      status,
      notes,
      organizationId: orgId,
      shapeData: shapeData || null,
      isDeleted: false
    });
    
    console.log(`テスト物件を作成しました: ${name} (ID: ${property._id})`);
    return property;
  } catch (error) {
    console.error('テスト物件作成エラー:', error);
    throw error;
  }
};