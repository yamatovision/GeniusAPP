/**
 * 物件データモデル
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ZoneType, FireZone, ShadowRegulation, PropertyStatus, Point } from '../../types';

/**
 * 物件ドキュメントインターフェース
 */
export interface PropertyDocument extends Document {
  name: string;                 // 物件名
  address: string;              // 住所
  area: number;                 // 敷地面積（㎡）
  zoneType: ZoneType;           // 用途地域
  fireZone: FireZone;           // 防火地域区分
  shadowRegulation?: ShadowRegulation; // 日影規制
  buildingCoverage: number;     // 建蔽率（%）
  floorAreaRatio: number;       // 容積率（%）
  heightLimit?: number;         // 高さ制限（m）
  roadWidth?: number;           // 前面道路幅員（m）
  allowedBuildingArea?: number; // 許容建築面積（㎡）
  price?: number;               // 想定取得価格（円）
  status: PropertyStatus;       // 物件ステータス
  notes?: string;               // 備考・メモ
  organizationId: mongoose.Types.ObjectId; // 所属組織ID
  shapeData?: {                 // 敷地形状データ
    points: Point[];            // 境界点座標の配列
    width?: number;             // 敷地間口（m）
    depth?: number;             // 敷地奥行（m）
    sourceFile?: string;        // 元ファイル名
  };
  location?: {                  // 位置情報
    type: string;               // GeoJSON型（Point）
    coordinates: [number, number]; // [経度, 緯度]
  };
  isDeleted: boolean;           // 論理削除フラグ
  createdAt: Date;              // 作成日時
  updatedAt: Date;              // 更新日時
}

/**
 * 敷地形状データスキーマ
 */
const PointSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
}, { _id: false });

const ShapeDataSchema = new Schema({
  points: { type: [PointSchema], required: true },
  width: { type: Number },
  depth: { type: Number },
  sourceFile: { type: String }
}, { _id: false });

/**
 * 物件スキーマ
 */
const PropertySchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 100
  },
  address: { 
    type: String, 
    required: true,
    trim: true, 
    maxlength: 200
  },
  area: { 
    type: Number, 
    required: true,
    min: 0
  },
  zoneType: { 
    type: String, 
    required: true,
    enum: Object.values(ZoneType)
  },
  fireZone: { 
    type: String, 
    required: true,
    enum: Object.values(FireZone)
  },
  shadowRegulation: { 
    type: String,
    enum: Object.values(ShadowRegulation),
    default: ShadowRegulation.NONE
  },
  buildingCoverage: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  floorAreaRatio: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1000
  },
  heightLimit: { 
    type: Number,
    min: 0
  },
  roadWidth: { 
    type: Number,
    min: 0
  },
  allowedBuildingArea: { 
    type: Number,
    min: 0
  },
  price: { 
    type: Number,
    min: 0
  },
  status: { 
    type: String,
    enum: Object.values(PropertyStatus),
    default: PropertyStatus.NEW
  },
  notes: { 
    type: String,
    maxlength: 1000
  },
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization',
    required: true,
    index: true
  },
  shapeData: { 
    type: ShapeDataSchema,
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      validate: {
        validator: function(v: any) {
          return Array.isArray(v) && v.length === 2;
        },
        message: 'Location must be a valid [longitude, latitude] array'
      }
    }
  },
  isDeleted: { 
    type: Boolean,
    default: false,
    index: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// インデックス作成
PropertySchema.index({ name: 'text', address: 'text' });
PropertySchema.index({ location: '2dsphere' });
PropertySchema.index({ organizationId: 1, isDeleted: 1 });

// allowedBuildingAreaの自動計算
PropertySchema.pre('save', function(this: PropertyDocument, next) {
  if (this.area && this.buildingCoverage) {
    this.allowedBuildingArea = this.area * (this.buildingCoverage / 100);
  }
  next();
});

// デフォルトクエリに論理削除フラグを追加
PropertySchema.pre(/^find/, function(this: any, next) {
  // すでに isDeleted が指定されていない場合のみデフォルト条件を追加
  if (this._conditions.isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Property = mongoose.model<PropertyDocument>('Property', PropertySchema);

export default Property;