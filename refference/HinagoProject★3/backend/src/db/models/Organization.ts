/**
 * 組織モデル
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { Organization as OrganizationType, SubscriptionType } from '../../types';

// TypeScriptでのドキュメント型定義
export interface OrganizationDocument extends Document, Omit<OrganizationType, 'id'> {}

// モデルのインターフェース
export interface OrganizationModel extends Model<OrganizationDocument> {
  findByName(name: string): Promise<OrganizationDocument | null>;
}

// スキーマ定義
const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: {
      type: String,
      required: [true, '組織名は必須です'],
      unique: true,
      trim: true,
      minlength: [1, '組織名は1文字以上である必要があります'],
      maxlength: [100, '組織名は100文字以下である必要があります'],
    },
    subscription: {
      type: String,
      enum: Object.values(SubscriptionType),
      default: SubscriptionType.FREE,
      required: true,
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

// 組織名で検索するスタティックメソッド
organizationSchema.statics.findByName = async function (name: string): Promise<OrganizationDocument | null> {
  return this.findOne({ name });
};

// モデル生成
const Organization = mongoose.model<OrganizationDocument, OrganizationModel>('Organization', organizationSchema);

export default Organization;