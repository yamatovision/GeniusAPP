/**
 * 履歴データモデル
 */
import mongoose, { Document, Schema } from 'mongoose';
import { HistoryAction } from '../../types';

/**
 * 履歴ドキュメントインターフェース
 */
export interface HistoryDocument extends Document {
  propertyId: mongoose.Types.ObjectId; // 物件ID
  userId: mongoose.Types.ObjectId;     // 操作ユーザーID
  action: HistoryAction;               // アクション種別
  description: string;                 // 変更内容の説明
  details?: Record<string, any>;       // 詳細情報（変更前後の値など）
  createdAt: Date;                     // 作成日時
  updatedAt: Date;                     // 更新日時
}

/**
 * 履歴スキーマ
 */
const HistorySchema = new Schema({
  propertyId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Property',
    required: true,
    index: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  action: { 
    type: String, 
    required: true,
    enum: Object.values(HistoryAction)
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  details: { 
    type: Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// インデックス作成
HistorySchema.index({ propertyId: 1, createdAt: -1 });
HistorySchema.index({ action: 1 });

const History = mongoose.model<HistoryDocument>('History', HistorySchema);

export default History;