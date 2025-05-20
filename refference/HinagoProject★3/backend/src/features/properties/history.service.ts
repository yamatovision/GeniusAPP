/**
 * 履歴サービス
 * 物件履歴の記録・取得などを行うサービス
 */
import mongoose from 'mongoose';
import { History, HistoryDocument } from '../../db/models';
import { HistoryAction } from '../../types';
import logger from '../../common/utils/logger';

/**
 * 履歴作成パラメータインターフェース
 */
interface CreateHistoryParams {
  propertyId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  action: HistoryAction;
  description: string;
  details?: Record<string, any>;
}

/**
 * 履歴取得フィルターインターフェース
 */
export interface HistoryFilter {
  page?: number;
  limit?: number;
  action?: HistoryAction;
}

/**
 * 履歴サービスクラス
 */
class HistoryService {
  /**
   * 履歴を作成
   * @param params 履歴作成パラメータ
   * @returns 作成された履歴
   */
  async createHistory(params: CreateHistoryParams): Promise<HistoryDocument> {
    try {
      // 物件IDと利用者IDをObjectIDに変換
      const propertyId = typeof params.propertyId === 'string' 
        ? new mongoose.Types.ObjectId(params.propertyId)
        : params.propertyId;
      
      const userId = typeof params.userId === 'string'
        ? new mongoose.Types.ObjectId(params.userId)
        : params.userId;
      
      // 詳細情報から機微情報をフィルタリング
      const sanitizedDetails = this.sanitizeDetails(params.details || {});
      
      // 履歴を作成
      const history = await History.create({
        propertyId,
        userId,
        action: params.action,
        description: params.description,
        details: sanitizedDetails
      });
      
      return history;
    } catch (error) {
      logger.error('History creation error:', error);
      throw error;
    }
  }
  
  /**
   * 物件の履歴を取得
   * @param propertyId 物件ID
   * @param filter フィルター条件
   * @returns 履歴一覧とメタデータ
   */
  async getPropertyHistory(
    propertyId: string | mongoose.Types.ObjectId,
    filter: HistoryFilter = {}
  ): Promise<{ history: HistoryDocument[], meta: { total: number, page: number, limit: number, totalPages: number } }> {
    try {
      // パラメータのデフォルト値設定
      const page = filter.page || 1;
      const limit = filter.limit || 20;
      const skip = (page - 1) * limit;
      
      // クエリ条件構築
      const query: any = { propertyId };
      
      if (filter.action) {
        query.action = filter.action;
      }
      
      // 総件数取得
      const total = await History.countDocuments(query);
      
      // 履歴取得
      const history = await History.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email');
      
      // メタデータ構築
      const totalPages = Math.ceil(total / limit);
      
      return {
        history,
        meta: {
          total,
          page,
          limit,
          totalPages
        }
      };
    } catch (error) {
      logger.error('History retrieval error:', error);
      throw error;
    }
  }
  
  /**
   * 詳細情報から機微情報をフィルタリング
   * @param details 元の詳細情報
   * @returns フィルタリングされた詳細情報
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // 機微情報のフィルタリング（価格情報など）
    if (sanitized.previous?.price || sanitized.current?.price) {
      sanitized.priceChanged = true;
      delete sanitized.previous?.price;
      delete sanitized.current?.price;
    }
    
    // パスワードなどの除外
    if (sanitized.password) delete sanitized.password;
    if (sanitized.previous?.password) delete sanitized.previous.password;
    if (sanitized.current?.password) delete sanitized.current.password;
    
    return sanitized;
  }
}

export default new HistoryService();