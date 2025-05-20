/**
 * 物件サービス
 * 物件の作成・取得・更新・削除などを行うサービス
 */
import mongoose from 'mongoose';
import { Property, PropertyDocument } from '../../db/models';
import { HistoryAction, PropertyStatus, Point } from '../../types';
import type { PropertyCreateData, PropertyUpdateData } from '../../types';
import { geocodeAddress } from './geocoding.service';
import historyService from './history.service';
import logger from '../../common/utils/logger';

/**
 * 物件取得フィルターインターフェース
 */
export interface PropertyQueryFilter {
  page?: number;
  limit?: number;
  sort?: string;
  fields?: string;
  expand?: string;
  name?: string;
  address?: string;
  area?: {
    min?: number;
    max?: number;
  };
  zoneType?: PropertyStatus;
  status?: PropertyStatus;
}

/**
 * 物件サービスクラス
 */
class PropertyService {
  /**
   * 物件一覧を取得
   * @param organizationId 組織ID
   * @param filter フィルター条件
   * @returns 物件一覧とメタデータ
   */
  async getProperties(
    organizationId: string | mongoose.Types.ObjectId,
    filter: PropertyQueryFilter = {}
  ): Promise<{ properties: PropertyDocument[], meta: { total: number, page: number, limit: number, totalPages: number } }> {
    try {
      console.log('物件取得開始 - 組織ID:', organizationId);
      console.log('デバッグ - Mongoose接続状態:', mongoose.connection.readyState);
      
      // パラメータのデフォルト値設定
      const page = filter.page || 1;
      const limit = filter.limit || 20;
      const skip = (page - 1) * limit;
      
      // クエリ条件構築
      const query: any = { organizationId, isDeleted: false };
      
      console.log('物件検索クエリ:', JSON.stringify(query));
      
      // 検索条件の追加
      if (filter.name) {
        query.$or = [
          { name: new RegExp(filter.name, 'i') },
          { name: { $text: { $search: filter.name } } }
        ];
      }
      
      if (filter.address) {
        if (!query.$or) query.$or = [];
        query.$or.push(
          { address: new RegExp(filter.address, 'i') },
          { address: { $text: { $search: filter.address } } }
        );
      }
      
      if (filter.area) {
        const areaQuery: any = {};
        if (filter.area.min) areaQuery.$gte = filter.area.min;
        if (filter.area.max) areaQuery.$lte = filter.area.max;
        if (Object.keys(areaQuery).length > 0) {
          query.area = areaQuery;
        }
      }
      
      if (filter.zoneType) {
        query.zoneType = filter.zoneType;
      }
      
      if (filter.status) {
        query.status = filter.status;
      }
      
      // ソート条件の構築
      let sortOption: any = { updatedAt: -1 };
      if (filter.sort) {
        sortOption = {};
        const sortFields = filter.sort.split(',');
        
        sortFields.forEach(field => {
          const [fieldName, direction] = field.split(':');
          sortOption[fieldName] = direction === 'desc' ? -1 : 1;
        });
      }
      
      // 投影フィールドの設定
      let projection: Record<string, number> = {};
      if (filter.fields) {
        projection = filter.fields.split(',').reduce<Record<string, number>>((obj, field) => {
          obj[field] = 1;
          return obj;
        }, {});
      }
      
      console.log('総件数取得開始...');
      
      // タイムアウト処理を追加
      const queryTimeoutMs = 3000; // 3秒
      
      // 総件数取得（タイムアウト付き）
      const totalPromise = Property.countDocuments(query).maxTimeMS(queryTimeoutMs).exec();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('DB query timeout')), queryTimeoutMs);
      });
      
      let total = 0;
      try {
        total = await Promise.race([totalPromise, timeoutPromise]) as number;
        console.log('総件数取得完了:', total);
      } catch (countError) {
        console.warn('総件数取得タイムアウトまたはエラー:', countError);
        // エラーでも処理を継続（0件として扱う）
        total = 0;
      }
      
      console.log('物件検索開始...');
      
      // クエリ実行
      let propertyQuery = Property.find(query, projection)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .maxTimeMS(queryTimeoutMs); // MongoDBクエリタイムアウト設定
      
      // 関連データの展開
      if (filter.expand) {
        const expandFields = filter.expand.split(',');
        
        if (expandFields.includes('shapeData') && !filter.fields) {
          // shapeDataが展開指定されている場合に、明示的に含める
          propertyQuery = propertyQuery.select('+shapeData');
        }
      }
      
      let properties: PropertyDocument[] = [];
      try {
        // タイムアウト付きでクエリ実行
        const propertiesPromise = propertyQuery.lean().exec();
        properties = await Promise.race([propertiesPromise, timeoutPromise]) as PropertyDocument[];
        console.log('クエリ実行完了, 結果件数:', properties.length);
      } catch (execError) {
        console.warn('クエリ実行タイムアウトまたはエラー:', execError);
        // エラーでも処理を継続（空配列として扱う）
        properties = [];
      }
      
      // メタデータ構築
      const totalPages = Math.ceil(total / limit);
      
      return {
        properties,
        meta: {
          total,
          page,
          limit,
          totalPages
        }
      };
    } catch (error) {
      console.error('物件取得エラー:', error);
      logger.error('Error getting properties:', error);
      // エラーが発生しても空の結果を返す
      return {
        properties: [],
        meta: {
          total: 0,
          page: filter.page || 1,
          limit: filter.limit || 20,
          totalPages: 0
        }
      };
    }
  }
  
  /**
   * 物件詳細を取得
   * @param propertyId 物件ID
   * @param organizationId 組織ID（アクセス制御用）
   * @param options 取得オプション
   * @returns 物件詳細
   */
  async getPropertyById(
    propertyId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId,
    options: { fields?: string, expand?: string } = {}
  ): Promise<PropertyDocument | null> {
    try {
      // 投影フィールドの設定
      let projection: Record<string, number> = {};
      if (options.fields) {
        projection = options.fields.split(',').reduce<Record<string, number>>((obj, field) => {
          obj[field] = 1;
          return obj;
        }, {});
      }
      
      // クエリ構築
      let query = Property.findOne(
        { 
          _id: propertyId,
          organizationId
        },
        projection
      );
      
      // 関連データの展開
      if (options.expand) {
        const expandFields = options.expand.split(',');
        
        if (expandFields.includes('shapeData') && !options.fields) {
          // shapeDataが展開指定されている場合に、明示的に含める
          query = query.select('+shapeData');
        }
      }
      
      return await query.exec();
    } catch (error) {
      logger.error(`Error getting property by ID ${propertyId}:`, error);
      throw error;
    }
  }
  
  /**
   * 新規物件を作成
   * @param propertyData 物件作成データ
   * @param organizationId 組織ID
   * @param userId 作成ユーザーID
   * @returns 作成された物件
   */
  async createProperty(
    propertyData: PropertyCreateData,
    organizationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<PropertyDocument> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 住所から位置情報を取得
      let location = null;
      if (propertyData.address) {
        const geocodeResult = await geocodeAddress(propertyData.address);
        if (geocodeResult) {
          location = {
            type: 'Point',
            coordinates: [geocodeResult.longitude, geocodeResult.latitude]
          };
        }
      }
      
      // ステータスが指定されていない場合はデフォルト値を設定
      if (!propertyData.status) {
        propertyData.status = PropertyStatus.NEW;
      }
      
      // 許容建築面積を計算
      const allowedBuildingArea = 
        propertyData.area && propertyData.buildingCoverage
          ? propertyData.area * (propertyData.buildingCoverage / 100)
          : undefined;
      
      // 物件を作成
      const property = await Property.create(
        [{
          ...propertyData,
          organizationId,
          location,
          allowedBuildingArea
        }],
        { session }
      );
      
      // 履歴を記録
      await historyService.createHistory({
        propertyId: property[0]._id,
        userId,
        action: HistoryAction.CREATE,
        description: '物件を新規作成しました',
        details: {
          name: property[0].name,
          address: property[0].address
        }
      });
      
      await session.commitTransaction();
      
      return property[0];
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error creating property:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * 物件を更新
   * @param propertyId 物件ID
   * @param propertyData 更新データ
   * @param organizationId 組織ID（アクセス制御用）
   * @param userId 更新ユーザーID
   * @returns 更新された物件
   */
  async updateProperty(
    propertyId: string | mongoose.Types.ObjectId,
    propertyData: PropertyUpdateData,
    organizationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<PropertyDocument | null> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 現在の物件データを取得
      const existingProperty = await Property.findOne(
        { _id: propertyId, organizationId }
      ).session(session);
      
      if (!existingProperty) {
        return null;
      }
      
      // 変更内容を記録
      const changes: Record<string, any> = {};
      const previous: Record<string, any> = {};
      const current: Record<string, any> = {};
      
      Object.keys(propertyData).forEach(key => {
        if (key !== 'organizationId' && 
            propertyData[key as keyof typeof propertyData] !== undefined && 
            String(existingProperty.get(key)) !== String(propertyData[key as keyof typeof propertyData])) {
          changes[key] = true;
          previous[key] = existingProperty.get(key);
          current[key] = propertyData[key as keyof typeof propertyData];
        }
      });
      
      // 住所が変更された場合、位置情報を更新
      let location = existingProperty.location;
      if (propertyData.address && propertyData.address !== existingProperty.address) {
        const geocodeResult = await geocodeAddress(propertyData.address);
        if (geocodeResult) {
          location = {
            type: 'Point',
            coordinates: [geocodeResult.longitude, geocodeResult.latitude]
          };
        }
      }
      
      // 許容建築面積を計算
      let allowedBuildingArea = existingProperty.allowedBuildingArea;
      const area = propertyData.area !== undefined ? propertyData.area : existingProperty.area;
      const buildingCoverage = propertyData.buildingCoverage !== undefined 
        ? propertyData.buildingCoverage 
        : existingProperty.buildingCoverage;
      
      if (propertyData.area !== undefined || propertyData.buildingCoverage !== undefined) {
        allowedBuildingArea = area * (buildingCoverage / 100);
      }
      
      // 物件を更新
      const updatedProperty = await Property.findOneAndUpdate(
        { _id: propertyId, organizationId },
        { 
          ...propertyData,
          location: location,
          allowedBuildingArea
        },
        { new: true, runValidators: true, session }
      );
      
      // 変更があれば履歴を記録
      if (Object.keys(changes).length > 0) {
        // 変更内容の説明を構築
        let description = '物件情報を更新しました';
        if (changes.name) {
          description = `物件名を「${previous.name}」から「${current.name}」に変更しました`;
        } else if (changes.status) {
          description = `ステータスを「${previous.status}」から「${current.status}」に変更しました`;
        } else if (changes.address) {
          description = `住所を更新しました`;
        }
        
        await historyService.createHistory({
          propertyId,
          userId,
          action: HistoryAction.UPDATE,
          description,
          details: {
            previous,
            current
          }
        });
      }
      
      await session.commitTransaction();
      
      return updatedProperty;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error updating property ${propertyId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * 物件を部分更新
   * @param propertyId 物件ID
   * @param propertyData 部分更新データ
   * @param organizationId 組織ID（アクセス制御用）
   * @param userId 更新ユーザーID
   * @returns 更新された物件
   */
  async patchProperty(
    propertyId: string | mongoose.Types.ObjectId,
    propertyData: Partial<PropertyUpdateData>,
    organizationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<PropertyDocument | null> {
    // 内部的には同じ処理を使用
    return this.updateProperty(propertyId, propertyData, organizationId, userId);
  }
  
  /**
   * 物件を削除（論理削除）
   * @param propertyId 物件ID
   * @param organizationId 組織ID（アクセス制御用）
   * @param userId 削除ユーザーID
   * @returns 削除されたかどうか
   */
  async deleteProperty(
    propertyId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 物件が存在し、指定された組織に属しているか確認
      const property = await Property.findOne(
        { _id: propertyId, organizationId }
      ).session(session);
      
      if (!property) {
        return false;
      }
      
      // 論理削除を実行
      const result = await Property.updateOne(
        { _id: propertyId, organizationId },
        { isDeleted: true }
      ).session(session);
      
      // 履歴を記録
      await historyService.createHistory({
        propertyId,
        userId,
        action: HistoryAction.DELETE,
        description: `物件「${property.name}」を削除しました`,
        details: {
          name: property.name,
          address: property.address
        }
      });
      
      await session.commitTransaction();
      
      return result.modifiedCount > 0;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error deleting property ${propertyId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * 敷地形状を更新
   * @param propertyId 物件ID
   * @param shapeData 敷地形状データ
   * @param organizationId 組織ID（アクセス制御用）
   * @param userId 更新ユーザーID
   * @returns 更新された物件
   */
  async updatePropertyShape(
    propertyId: string | mongoose.Types.ObjectId,
    shapeData: { points: Point[], width?: number, depth?: number, sourceFile?: string },
    organizationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<PropertyDocument | null> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 物件が存在し、指定された組織に属しているか確認
      const property = await Property.findOne(
        { _id: propertyId, organizationId }
      ).session(session);
      
      if (!property) {
        return null;
      }
      
      // 形状データを更新
      const updatedProperty = await Property.findOneAndUpdate(
        { _id: propertyId, organizationId },
        { shapeData },
        { new: true, runValidators: true, session }
      );
      
      // 履歴を記録
      await historyService.createHistory({
        propertyId,
        userId,
        action: HistoryAction.UPDATE,
        description: '敷地形状を更新しました',
        details: {
          shapeUpdated: true,
          pointCount: shapeData.points.length
        }
      });
      
      await session.commitTransaction();
      
      return updatedProperty;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error updating property shape ${propertyId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default new PropertyService();