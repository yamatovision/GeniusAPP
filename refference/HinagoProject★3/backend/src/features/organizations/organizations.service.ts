/**
 * 組織サービス
 */
import Organization, { OrganizationDocument } from '../../db/models/Organization';
import User from '../../db/models/User';
import { ErrorCodes } from '../../common/utils/response';
import { SubscriptionType } from '../../types';

// 各サブスクリプションプランの制限情報
const subscriptionLimits = {
  [SubscriptionType.FREE]: {
    maxUsers: 5,
    maxProperties: 10,
    maxStorage: 1 * 1024 * 1024 * 1024, // 1GB
    features: ['basic_volume_check', 'property_management'],
  },
  [SubscriptionType.BASIC]: {
    maxUsers: 20,
    maxProperties: 50,
    maxStorage: 5 * 1024 * 1024 * 1024, // 5GB
    features: ['basic_volume_check', 'property_management', 'profitability_analysis'],
  },
  [SubscriptionType.PREMIUM]: {
    maxUsers: Infinity,
    maxProperties: Infinity,
    maxStorage: 50 * 1024 * 1024 * 1024, // 50GB
    features: [
      'advanced_volume_check',
      'property_management',
      'profitability_analysis',
      'scenario_comparison',
      'pdf_reports',
      'api_access',
    ],
  },
};

interface OrganizationUpdateData {
  name?: string;
}

interface OrganizationStats {
  userCount: number;
  propertyCount: number;
  storageUsed: number;
  storageLimit: number;
}

interface OrganizationWithStats extends OrganizationDocument {
  stats?: OrganizationStats;
  limits?: typeof subscriptionLimits[SubscriptionType.FREE];
}

/**
 * 組織情報を取得
 */
export const getOrganizationById = async (
  organizationId: string,
  includeStats = false
): Promise<OrganizationWithStats> => {
  try {
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定された組織が見つかりません',
      };
    }
    
    // 組織オブジェクトをJSON形式に変換
    const orgObject = organization.toJSON();
    const organizationWithStats = orgObject as OrganizationWithStats;
    
    // 統計情報も含める場合
    if (includeStats) {
      // ユーザー数をカウント
      const userCount = await User.countDocuments({ organizationId });
      
      // TODO: 物件数と使用ストレージ容量は物件モデル実装後に追加
      const propertyCount = 0;
      const storageUsed = 0;
      
      // サブスクリプションタイプに基づく制限
      const limits = subscriptionLimits[organization.subscription];
      
      // 統計情報を追加
      organizationWithStats.stats = {
        userCount,
        propertyCount,
        storageUsed,
        storageLimit: limits.maxStorage,
      };
      
      // 制限情報を追加
      organizationWithStats.limits = limits;
    }
    
    return organizationWithStats;
  } catch (error: any) {
    // 既に形式化されたエラーはそのまま投げる
    if (error.code) throw error;
    
    console.error('組織情報取得エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: '組織情報の取得中にエラーが発生しました',
      error,
    };
  }
};

/**
 * 組織情報を更新
 */
export const updateOrganization = async (
  organizationId: string,
  updateData: OrganizationUpdateData
): Promise<OrganizationDocument> => {
  try {
    // 更新前に組織が存在するか確認
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定された組織が見つかりません',
      };
    }
    
    // 組織名が変更される場合は重複チェック
    if (updateData.name && updateData.name !== organization.name) {
      const existingOrganization = await Organization.findOne({ name: updateData.name });
      
      if (existingOrganization) {
        throw {
          code: ErrorCodes.RESOURCE_ALREADY_EXISTS,
          message: 'この組織名は既に使用されています',
        };
      }
    }
    
    // 更新データを準備
    const dataToUpdate: any = {};
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    
    // 更新実行
    const updatedOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      { $set: dataToUpdate },
      { new: true, runValidators: true }
    );
    
    if (!updatedOrganization) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定された組織が見つかりません',
      };
    }
    
    return updatedOrganization;
  } catch (error: any) {
    // 既に形式化されたエラーはそのまま投げる
    if (error.code) throw error;
    
    console.error('組織情報更新エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: '組織情報の更新中にエラーが発生しました',
      error,
    };
  }
};