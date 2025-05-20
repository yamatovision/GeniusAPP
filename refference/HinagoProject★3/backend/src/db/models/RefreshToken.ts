/**
 * リフレッシュトークンモデル
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { RefreshToken as RefreshTokenType } from '../../types';

// TypeScriptでのドキュメント型定義
export interface RefreshTokenDocument extends Document, Omit<RefreshTokenType, 'id'> {}

// モデルのインターフェース
export interface RefreshTokenModel extends Model<RefreshTokenDocument> {
  findValidToken(token: string): Promise<RefreshTokenDocument | null>;
  revokeToken(token: string): Promise<boolean>;
  revokeAllUserTokens(userId: string): Promise<boolean>;
}

// スキーマ定義
const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: {
      type: String,
      required: [true, 'ユーザーIDは必須です'],
    },
    token: {
      type: String,
      required: [true, 'トークンは必須です'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, '有効期限は必須です'],
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAtとupdatedAtを自動的に管理
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// 期限切れのトークンを自動的に削除するためのインデックス
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 有効なトークンを検索するスタティックメソッド
refreshTokenSchema.statics.findValidToken = async function (token: string): Promise<RefreshTokenDocument | null> {
  return this.findOne({
    token,
    expiresAt: { $gt: new Date() }, // 有効期限が現在時刻より後
    isRevoked: false, // 無効化されていない
  });
};

// トークンを無効化するスタティックメソッド
refreshTokenSchema.statics.revokeToken = async function (token: string): Promise<boolean> {
  const result = await this.updateOne({ token }, { isRevoked: true });
  return result.modifiedCount > 0;
};

// ユーザーの全トークンを無効化するスタティックメソッド
refreshTokenSchema.statics.revokeAllUserTokens = async function (userId: string): Promise<boolean> {
  const result = await this.updateMany({ userId }, { isRevoked: true });
  return result.modifiedCount > 0;
};

// モデル生成
const RefreshToken = mongoose.model<RefreshTokenDocument, RefreshTokenModel>('RefreshToken', refreshTokenSchema);

export default RefreshToken;