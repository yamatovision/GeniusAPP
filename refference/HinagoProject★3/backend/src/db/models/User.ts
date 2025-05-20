/**
 * ユーザーモデル
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import config from '../../config';
import { User as UserType, UserRole } from '../../types';
import { hashPassword, verifyPassword } from '../../common/utils/crypto';

// TypeScriptでのドキュメント型定義
export interface UserDocument extends Document, Omit<UserType, 'id'> {
  password: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// モデルのインターフェース
export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
}

// スキーマ定義
const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: [true, 'メールアドレスは必須です'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, '有効なメールアドレスを入力してください'],
    },
    password: {
      type: String,
      required: [true, 'パスワードは必須です'],
      minlength: [8, 'パスワードは8文字以上である必要があります'],
      select: false, // デフォルトではパスワードを取得しない
    },
    name: {
      type: String,
      required: [true, '名前は必須です'],
      trim: true,
      minlength: [1, '名前は1文字以上である必要があります'],
      maxlength: [50, '名前は50文字以下である必要があります'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      required: true,
    },
    organizationId: {
      type: String,
      required: [true, '組織IDは必須です'],
    },
  },
  {
    timestamps: true, // createdAtとupdatedAtを自動的に管理
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
      },
    },
  }
);

// パスワードの保存前にハッシュ化
userSchema.pre('save', async function (next) {
  // パスワードが変更されていない場合はスキップ
  if (!this.isModified('password')) return next();

  try {
    // パスワードのハッシュ化
    this.password = await hashPassword(this.password);
    next();
  } catch (error: any) {
    next(error);
  }
});

// パスワード比較メソッド
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await verifyPassword(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// メールアドレスで検索するスタティックメソッド
userSchema.statics.findByEmail = async function (email: string): Promise<UserDocument | null> {
  return this.findOne({ email }).select('+password');
};

// モデル生成
const User = mongoose.model<UserDocument, UserModel>('User', userSchema);

export default User;