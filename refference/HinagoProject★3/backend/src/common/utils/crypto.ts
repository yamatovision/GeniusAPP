/**
 * 暗号化ユーティリティ
 * bcryptの代わりにNode.js標準のcryptoモジュールを使用
 */
import crypto from 'crypto';
import config from '../../config';

const ITERATIONS = 12000; // bcryptのsaltRounds相当のイテレーション数
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * パスワードをハッシュ化する
 * @param password ハッシュ化するパスワード
 * @returns {Promise<string>} salt:hashedPassword 形式の文字列
 */
export const hashPassword = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // ランダムなソルトを生成（16バイト）
      const salt = crypto.randomBytes(16).toString('hex');
      
      // PBKDF2でパスワードをハッシュ化
      crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
        if (err) return reject(err);
        
        // salt:hashedPassword の形式で保存
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * パスワードを検証する
 * @param candidatePassword 検証するパスワード
 * @param hashedPassword salt:hashedPassword 形式のハッシュ済みパスワード
 * @returns {Promise<boolean>} パスワードが一致するか
 */
export const verifyPassword = (candidatePassword: string, hashedPassword: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    try {
      // ハッシュされたパスワードからsaltとパスワードハッシュを取得
      const [salt, originalHash] = hashedPassword.split(':');
      
      if (!salt || !originalHash) {
        return resolve(false);
      }
      
      // 同じパラメータでハッシュ化して比較
      crypto.pbkdf2(candidatePassword, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
        if (err) return reject(err);
        
        // ハッシュ値を比較
        resolve(derivedKey.toString('hex') === originalHash);
      });
    } catch (err) {
      reject(err);
    }
  });
};