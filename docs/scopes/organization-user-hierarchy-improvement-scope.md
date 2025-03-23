# 組織・ユーザー階層管理の改善スコープ

## 概要

AppGeniusの組織・ユーザー管理機能における階層構造を明確化し、権限分離を強化するための改善スコープです。既存の組織管理機能をベースに、より明確な権限階層と役割分担を実現し、エンタープライズ向けの管理機能を強化します。

## 目的

1. 権限階層の明確化（SuperAdmin/組織Admin/一般ユーザー）
2. 組織作成プロセスの改善（管理者指定とSuperAdminの自動追加防止）
3. UI/UXの改善と権限に応じた機能アクセス制御
4. データアクセス制御の強化（組織間データ分離の徹底）
5. 組織管理者のユーザー管理能力強化

## 現状分析

### 現状の問題点

1. **権限構造の不明確さ**
   - SuperAdminと組織管理者の役割分担が不明確
   - 組織作成時、作成者（SuperAdmin）が自動的に組織メンバーに追加される

2. **ユーザー管理の流れの不自然さ**
   - 組織作成には必ずSuperAdmin権限が必要
   - 組織管理者が自組織のユーザーを管理するための機能が不十分
   - 組織メンバー一覧取得API(`/organizations/{id}/members`)で権限エラー(403)が発生

3. **UIアクセス制御の不整合**
   - 権限レベルに応じた機能表示の制御が不十分
   - 特に組織管理画面のアクセス制御が不明確

4. **ユーザー管理の二重構造**
   - `/users`: SuperAdmin向けのシステム全体ユーザー管理画面
   - `/organizations/{id}/members`: 組織メンバー管理画面
   - 役割は異なるが、管理者のアクセス権限設計が整理されていない

## 改善計画

### 1. 権限構造の明確化

1. **権限階層の再定義**
   - **SuperAdmin**: システム全体管理者。組織作成・削除と全体監視が可能。直接的な組織参加は不要。
   - **組織Admin**: 特定組織のユーザー管理・設定・監視を担当。自組織のユーザー一覧を取得可能。
   - **一般ユーザー**: 通常機能のみを使用、自分の使用量確認可能。

2. **権限分離の実装**
   - 権限チェック関数を改良し、組織Adminがメンバー管理できるよう修正
   - バックエンドAPIのアクセス制御を権限モデルに合わせて調整

### 2. 組織作成プロセスの改善

1. **組織作成フローの変更**
   - 組織作成時に管理者メールアドレスを指定できるようにする
   - SuperAdminを自動的に組織メンバーに追加しないように変更
   - 管理者メールアドレスでユーザーを作成または既存ユーザーをアサイン

2. **コード修正**
   - `createOrganization`メソッドの更新
   - 組織管理者アカウント自動生成または既存ユーザーへの権限付与
   - 招待メール送信機能の追加

### 3. UI/UXの改善

1. **権限に応じたUI分離**
   - SuperAdmin: システム全体管理画面(`/users`など)と組織監視機能
   - 組織Admin: 自組織のユーザー管理画面(`/organizations/{id}/members`)と設定
   - 一般ユーザー: 基本機能と自分の使用量のみ

2. **組織メンバー管理画面の強化**
   - ユーザー一覧取得APIの権限修正（組織Adminもアクセス可能に）
   - メンバー招待・追加機能の実装
   - 使用量統計とユーザー活動の可視化

3. **ページ構造の整理**
   - システム全体ユーザー管理(`/users`)をSuperAdmin専用に維持
   - 組織メンバー管理(`/organizations/{id}/members`)を組織Admin向けに強化
   - デザインシステムの統一によるUX向上

### 4. データアクセス制御の強化

1. **組織間データ分離**
   - クエリに組織IDフィルタを徹底
   - 組織をまたいだデータ参照を防止するミドルウェア

2. **アクセス権チェックの統一**
   - `checkOrganizationAccess`関数の実装と全APIでの使用
   - 組織管理者のメンバー情報アクセス権限の保証

## 実装計画

### ファイル修正予定

1. **Backendコード修正**
   - `portal/backend/controllers/organization.controller.js` - 組織作成と管理関数の改善
   - `portal/backend/middlewares/auth.middleware.js` - 権限チェック関数の強化
   - `portal/backend/controllers/user.controller.js` - ユーザー管理の権限関連処理強化
   - `portal/backend/routes/organization.routes.js` - 組織メンバーAPIのアクセス制御調整

2. **Frontendコード修正**
   - `portal/frontend/src/components/organizations/OrganizationForm.js` - 組織作成フォームの改善
   - `portal/frontend/src/components/organizations/MemberManagement.js` - メンバー管理UIの強化
   - `portal/frontend/src/components/dashboard/Dashboard.js` - 権限に応じたダッシュボード表示

### 重要なAPI修正

1. **組織作成APIの変更**
   ```javascript
   // 修正後のAPI仕様
   POST /api/organizations
   {
     "name": "組織名",
     "description": "説明",
     "adminEmail": "admin@example.com", // 新規パラメーター（既存ユーザーまたは新規作成）
     "adminName": "管理者名",           // 新規ユーザー作成時のみ使用
     "monthlyBudget": 100000
   }
   ```

2. **組織メンバー一覧APIのアクセス制御修正**
   ```javascript
   // ユーザー一覧取得のアクセス制御修正
   exports.getOrganizationMembers = async (req, res) => {
     try {
       const { organizationId } = req.params;
       const organization = await Organization.findById(organizationId);
       
       if (!organization) {
         return res.status(404).json({ error: '組織が見つかりません' });
       }
       
       // SuperAdminまたは組織の管理者のみアクセス可能に修正
       const isOrgAdmin = organization.members.some(
         m => m.userId.toString() === req.userId.toString() && m.role === 'admin'
       );
       
       if (req.userRole !== 'super_admin' && !isOrgAdmin) {
         return res.status(403).json({ error: 'この操作を行う権限がありません' });
       }
       
       // 残りの処理...
     } catch (error) {
       // エラーハンドリング
     }
   };
   ```

3. **ユーザー一覧取得APIの修正**
   ```javascript
   // 組織管理者も自組織のユーザーリストを取得できるよう修正
   exports.getUsers = async (req, res) => {
     try {
       // クエリパラメータから取得
       const { page = 1, limit = 10, search = '', role, forOrganization, organizationId } = req.query;
       
       // 組織管理者向け権限チェック
       if (forOrganization && organizationId) {
         const organization = await Organization.findById(organizationId);
         if (!organization) {
           return res.status(404).json({ error: '組織が見つかりません' });
         }
         
         const isOrgAdmin = organization.members.some(
           m => m.userId.toString() === req.userId.toString() && m.role === 'admin'
         );
         
         // 組織管理者は自組織のユーザーリストを取得可能
         if (isOrgAdmin) {
           // 組織メンバーIDのリスト取得
           const memberIds = organization.members.map(m => m.userId);
           
           // メンバーの詳細情報を取得
           const users = await User.find({ _id: { $in: memberIds } })
             .select('-password')
             .sort({ createdAt: -1 });
           
           return res.status(200).json({
             users,
             totalUsers: users.length,
             totalPages: 1,
             currentPage: 1
           });
         }
       }
       
       // SuperAdmin向けの既存のユーザー一覧取得ロジック
       if (req.userRole !== 'super_admin') {
         return res.status(403).json({
           error: {
             code: 'PERMISSION_DENIED',
             message: 'スーパー管理者権限が必要です'
           }
         });
       }
       
       // 残りの処理...
     } catch (error) {
       // エラーハンドリング
     }
   };
   ```

## スケジュール

1. **設計と詳細計画**（1日）
   - 権限構造の詳細設計
   - APIインターフェース詳細設計
   - 組織管理者向けUIフロー設計

2. **バックエンド実装**（2日）
   - 組織コントローラーの修正
   - 認証ミドルウェアの改善
   - 組織メンバー管理APIの権限調整

3. **フロントエンド実装**（2日）
   - 組織メンバー管理画面の強化
   - 組織作成フォームの改善
   - 権限に応じたUI表示制御の実装

4. **テストと調整**（1日）
   - 各権限レベルでの機能テスト
   - 組織管理者によるメンバー管理テスト
   - エッジケースの検証

## 成果物

1. 権限階層が明確化された組織・ユーザー管理機能
2. 組織管理者が自組織のメンバーを管理できるUI/API
3. 組織作成時の管理者指定機能
4. 権限に応じたUI表示と機能制御
5. 実装ドキュメントと運用マニュアル

## 期待される効果

1. 企業ユーザーの管理効率向上
2. 権限分離による情報セキュリティの強化
3. 組織管理者による自律的なユーザー管理の実現
4. ユーザー招待・管理フローの合理化
5. エンタープライズ向けセルフサービス管理機能の実現