/**
 * ユーザーサービス
 */
import User, { UserDocument } from '../../db/models/User';
import Organization from '../../db/models/Organization';
import { ErrorCodes } from '../../common/utils/response';

interface UserPreferences {
  theme?: 'light' | 'dark';
  notifications?: {
    email?: boolean;
    browser?: boolean;
  };
  defaultViews?: {
    dashboard?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface UserUpdateData {
  name?: string;
  email?: string;
  preferences?: UserPreferences;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  search?: string;
}

interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 組織に所属するユーザー一覧を取得
 */
export const getOrganizationUsers = async (
  organizationId: string,
  options: PaginationOptions
): Promise<PaginationResult<UserDocument>> => {
  try {
    const { page = 1, limit = 20, sort, search } = options;
    
    // ベースクエリ（組織IDでフィルタリング）
    let query = User.find({ organizationId });
    
    // 検索クエリがある場合は名前かメールアドレスで検索
    if (search) {
      query = query.or([
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]);
    }

    // 件数カウント
    const total = await User.countDocuments(query);

    // ソート処理
    if (sort) {
      const [field, order] = sort.split(':');
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ [field]: sortOrder });
    } else {
      // デフォルトは更新日時の降順
      query = query.sort({ updatedAt: -1 });
    }

    // ページネーション
    const skip = (page - 1) * limit;
    const users = await query.skip(skip).limit(limit);
    
    // 結果整形
    return {
      items: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'ユーザー一覧の取得中にエラーが発生しました',
      error,
    };
  }
};

/**
 * ユーザー情報を取得
 */
export const getUserById = async (userId: string, includeOrganization = false): Promise<UserDocument> => {
  try {
    // 基本クエリ
    let user;
    
    // 組織情報も取得する場合
    if (includeOrganization) {
      user = await User.findById(userId).populate('organizationId', 'name subscription');
    } else {
      user = await User.findById(userId);
    }
    
    if (!user) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定されたユーザーが見つかりません',
      };
    }
    
    return user;
  } catch (error: any) {
    // 既に形式化されたエラーはそのまま投げる
    if (error.code) throw error;
    
    console.error('ユーザー情報取得エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'ユーザー情報の取得中にエラーが発生しました',
      error,
    };
  }
};

/**
 * ユーザー情報を更新
 */
export const updateUser = async (userId: string, updateData: UserUpdateData): Promise<UserDocument> => {
  try {
    // 更新前にユーザーが存在するか確認
    const user = await User.findById(userId);
    
    if (!user) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定されたユーザーが見つかりません',
      };
    }
    
    // メールアドレスが変更される場合は重複チェック
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      
      if (existingUser) {
        throw {
          code: ErrorCodes.RESOURCE_ALREADY_EXISTS,
          message: 'このメールアドレスは既に使用されています',
        };
      }
    }
    
    // 更新データを準備
    const dataToUpdate: any = {};
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.email !== undefined) dataToUpdate.email = updateData.email;
    
    // 更新実行
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: dataToUpdate },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定されたユーザーが見つかりません',
      };
    }
    
    return updatedUser;
  } catch (error: any) {
    // 既に形式化されたエラーはそのまま投げる
    if (error.code) throw error;
    
    console.error('ユーザー情報更新エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'ユーザー情報の更新中にエラーが発生しました',
      error,
    };
  }
};

/**
 * ユーザープロフィールを更新
 */
export const updateUserProfile = async (userId: string, updateData: UserUpdateData): Promise<UserDocument> => {
  try {
    // 更新前にユーザーが存在するか確認
    const user = await User.findById(userId);
    
    if (!user) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定されたユーザーが見つかりません',
      };
    }
    
    // メールアドレスが変更される場合は重複チェック
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      
      if (existingUser) {
        throw {
          code: ErrorCodes.RESOURCE_ALREADY_EXISTS,
          message: 'このメールアドレスは既に使用されています',
        };
      }
    }
    
    // 更新データを準備
    const dataToUpdate: any = {};
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.email !== undefined) dataToUpdate.email = updateData.email;
    
    // ユーザー設定が提供された場合、設定フィールドを追加/更新
    if (updateData.preferences) {
      // ここでMongooseスキーマに定義されていないpreferenceフィールドを追加更新するロジックを追加
      // カスタムフィールドとして扱い、必要に応じてスキーマ拡張も検討
      // MongoDB のフレキシブルさを活かして、スキーマに明示的に定義していないフィールドも使用可能
    }
    
    // 更新実行
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: dataToUpdate },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      throw {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: '指定されたユーザーが見つかりません',
      };
    }
    
    return updatedUser;
  } catch (error: any) {
    // 既に形式化されたエラーはそのまま投げる
    if (error.code) throw error;
    
    console.error('ユーザープロフィール更新エラー:', error);
    throw {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'ユーザープロフィールの更新中にエラーが発生しました',
      error,
    };
  }
};