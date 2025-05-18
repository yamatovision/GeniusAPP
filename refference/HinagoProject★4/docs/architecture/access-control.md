# アクセス制御マトリックス

## 1. 概要

このドキュメントではHinagoProject（ボリュームチェックシステム）のアクセス制御設計を定義します。
組織を基本単位とした権限制御により、組織内のデータ共有と組織間のデータ分離を両立させます。

## 2. 基本方針

1. 組織を基本単位としたアクセス制御
2. 同一組織内のユーザーは組織のデータを共有可能
3. 組織間のデータアクセスは基本的に遮断
4. 将来的な拡張性を考慮したロールベースのアクセス制御設計

## 3. ユーザーロール定義

現在は単一ロールのみ実装し、将来的な拡張性を考慮した設計とします。

| ロールID | ロール名 | 説明 |
|---------|---------|-----|
| USER    | 一般ユーザー | 組織内データへのフルアクセス権を持つ |

将来的に以下のロールを追加する可能性を考慮した設計とします：

| ロールID | ロール名 | 説明 |
|---------|---------|-----|
| ADMIN   | 管理者 | システム全体の管理権限を持つ |
| MANAGER | マネージャー | 組織内の全リソースを管理する権限を持つ |
| READ_ONLY | 閲覧ユーザー | 閲覧のみの制限付き権限を持つ |

## 4. リソースアクション定義

各リソースに対して以下のアクションを定義します：
- C: Create (作成)
- R: Read (読取)
- U: Update (更新)
- D: Delete (削除)

## 5. アクセス制御マトリックス

この表は現在と将来的な拡張を考慮したアクセス制御マトリックスです：

| リソース | アクション | USER | 将来: ADMIN | 将来: MANAGER | 将来: READ_ONLY |
|---------|-----------|------|----------|----------|------------|
| 組織 | C | ✗ | ✓ | ✗ | ✗ |
| 組織 | R | ✓* | ✓ | ✓* | ✓* |
| 組織 | U | ✓* | ✓ | ✓* | ✗ |
| 組織 | D | ✗ | ✓ | ✗ | ✗ |
| ユーザー | C | ✗ | ✓ | ✓* | ✗ |
| ユーザー | R | ✓* | ✓ | ✓* | ✓* |
| ユーザー | U | ✓† | ✓ | ✓* | ✗ |
| ユーザー | D | ✗ | ✓ | ✓* | ✗ |
| 物件 | C | ✓ | ✓ | ✓ | ✗ |
| 物件 | R | ✓* | ✓ | ✓* | ✓* |
| 物件 | U | ✓* | ✓ | ✓* | ✗ |
| 物件 | D | ✓* | ✓ | ✓* | ✗ |
| 物件形状 | C | ✓* | ✓ | ✓* | ✗ |
| 物件形状 | R | ✓* | ✓ | ✓* | ✓* |
| 物件形状 | U | ✓* | ✓ | ✓* | ✗ |
| 物件形状 | D | ✓* | ✓ | ✓* | ✗ |
| ボリュームチェック | C | ✓* | ✓ | ✓* | ✗ |
| ボリュームチェック | R | ✓* | ✓ | ✓* | ✓* |
| ボリュームチェック | U | ✓* | ✓ | ✓* | ✗ |
| ボリュームチェック | D | ✓* | ✓ | ✓* | ✗ |
| シナリオ | C | ✓* | ✓ | ✓* | ✗ |
| シナリオ | R | ✓* | ✓ | ✓* | ✓* |
| シナリオ | U | ✓* | ✓ | ✓* | ✗ |
| シナリオ | D | ✓* | ✓ | ✓* | ✗ |
| 収益性試算 | C | ✓* | ✓ | ✓* | ✗ |
| 収益性試算 | R | ✓* | ✓ | ✓* | ✓* |
| 収益性試算 | U | ✓* | ✓ | ✓* | ✗ |
| 収益性試算 | D | ✓* | ✓ | ✓* | ✗ |
| 文書 | C | ✓* | ✓ | ✓* | ✗ |
| 文書 | R | ✓* | ✓ | ✓* | ✓* |
| 文書 | U | ✓* | ✓ | ✓* | ✗ |
| 文書 | D | ✓* | ✓ | ✓* | ✗ |

凡例:
- ✓: 許可
- ✗: 禁止
- *: 自組織に関連するリソースのみ
- †: 自分自身のリソースのみ

## 6. 特殊条件

* **組織の閲覧 (R)**: ユーザーは自分の組織情報のみ閲覧可能。
* **ユーザーの閲覧 (R)**: ユーザーは同じ組織内のユーザー情報のみ閲覧可能。
* **ユーザーの更新 (U)**: ユーザーは自分自身のプロフィール情報のみ更新可能。
* **物件関連操作**: すべての物件関連操作（物件、形状、ボリュームチェック、シナリオ、収益性試算、文書）は同一組織内で共有。

## 7. 実装ガイドライン

### 7.1 バックエンド実装方式
```typescript
// auth.middleware.ts - 認証状態検証ミドルウェア
import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // 認証済みかどうかを確認（トークンの検証は前段階で実施）
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: '認証が必要です',
      code: 'AUTH_REQUIRED'
    });
  }
  
  next();
};

// authorization.middleware.ts - 組織ベースのアクセス制御ミドルウェア
import { Request, Response, NextFunction } from 'express';
import { Property } from '@shared/index';
import * as propertyService from '../properties/property.service';

// 組織に関連するリソースへのアクセスをチェック
export const checkOrganizationAccess = (resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { organizationId } = req.user;
    
    if (!id || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'リソースIDまたは組織IDが不正です',
        code: 'INVALID_RESOURCE_OR_ORG'
      });
    }
    
    try {
      let resource;
      
      // リソースタイプに応じたサービスの呼び出し
      switch (resourceType) {
        case 'property':
          resource = await propertyService.getPropertyById(id);
          break;
        case 'volumeCheck':
          // 物件IDから組織IDを取得するケース
          const volumeCheck = await volumeCheckService.getVolumeCheckById(id);
          if (!volumeCheck) {
            return res.status(404).json({
              success: false,
              error: 'リソースが見つかりません',
              code: 'RESOURCE_NOT_FOUND'
            });
          }
          
          // 関連物件を取得して組織IDをチェック
          const property = await propertyService.getPropertyById(volumeCheck.propertyId);
          resource = { organizationId: property?.organizationId };
          break;
        // 他のリソースタイプに応じたケース
        default:
          return res.status(400).json({
            success: false,
            error: '不明なリソースタイプです',
            code: 'INVALID_RESOURCE_TYPE'
          });
      }
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'リソースが見つかりません',
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      
      // 組織IDが一致するかチェック
      if (resource.organizationId !== organizationId) {
        return res.status(403).json({
          success: false,
          error: 'このリソースにアクセスする権限がありません',
          code: 'PERMISSION_DENIED'
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '内部サーバーエラー',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

// ユーザー自身の情報のみアクセスを許可するミドルウェア
export const checkSelfAccess = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { id: userId } = req.user;
  
  if (id !== userId) {
    return res.status(403).json({
      success: false,
      error: '自分自身の情報のみ更新できます',
      code: 'PERMISSION_DENIED'
    });
  }
  
  next();
};
```

### 7.2 ルーティングでの使用例
```typescript
// users.routes.ts
import express from 'express';
import * as userController from './users.controller';
import { requireAuth } from '../auth/auth.middleware';
import { checkSelfAccess, checkOrganizationAccess } from '../auth/authorization.middleware';

const router = express.Router();

// 自組織ユーザー一覧取得
router.get('/', requireAuth, userController.getUsers);

// 自身のプロフィール取得
router.get('/profile', requireAuth, userController.getProfile);

// ユーザープロフィール更新（自分自身のみ）
router.put('/:id', requireAuth, checkSelfAccess, userController.updateUser);

export default router;

// properties.routes.ts
import express from 'express';
import * as propertyController from './properties.controller';
import { requireAuth } from '../auth/auth.middleware';
import { checkOrganizationAccess } from '../auth/authorization.middleware';

const router = express.Router();

// 物件一覧取得（自組織のみ）
router.get('/', requireAuth, propertyController.getProperties);

// 物件作成
router.post('/', requireAuth, propertyController.createProperty);

// 物件詳細取得（自組織のみ）
router.get('/:id', requireAuth, checkOrganizationAccess('property'), propertyController.getProperty);

// 物件更新（自組織のみ）
router.put('/:id', requireAuth, checkOrganizationAccess('property'), propertyController.updateProperty);

// 物件削除（自組織のみ）
router.delete('/:id', requireAuth, checkOrganizationAccess('property'), propertyController.deleteProperty);

export default router;
```

### 7.3 フロントエンド権限制御
```typescript
// usePermissions.ts - 権限確認フック
import { useAuth } from './useAuth';

export const usePermissions = () => {
  const { user } = useAuth();
  
  // 基本アクセス権限チェック（認証済みかどうか）
  const isAuthenticated = !!user;
  
  // 組織リソースへのアクセス権限チェック
  const canAccessOrganizationResource = (resourceOrganizationId: string) => {
    if (!user) return false;
    return user.organizationId === resourceOrganizationId;
  };
  
  // 自分自身のリソースへのアクセス権限チェック
  const canAccessSelfResource = (resourceUserId: string) => {
    if (!user) return false;
    return user.id === resourceUserId;
  };
  
  return {
    isAuthenticated,
    canAccessOrganizationResource,
    canAccessSelfResource
  };
};

// UIコンポーネントでの使用例
function ResourceActionButton({ 
  resourceOrganizationId, 
  actionType, 
  children 
}) {
  const { isAuthenticated, canAccessOrganizationResource } = usePermissions();
  
  // 認証チェックと組織リソースへのアクセス権限チェック
  if (!isAuthenticated || !canAccessOrganizationResource(resourceOrganizationId)) {
    return null; // 権限がなければ非表示
  }
  
  return <button>{children}</button>;
}
```

## 8. データベース設計上の考慮事項

### 8.1 組織ID関連フィールド
すべての主要リソース（物件、ボリュームチェック、シナリオ、収益性試算、文書）には`organizationId`フィールドを持たせ、アクセス制御の基本とする。

### 8.2 クエリ最適化
組織IDによるフィルタリングがすべてのリソース検索クエリの基本となるため、`organizationId`フィールドにはインデックスを設定する。

### 8.3 カスケード削除設定
組織が削除された場合に関連するすべてのデータが削除されるよう、外部キー制約とカスケード設定を適切に行う。

## 9. セキュリティ上の考慮事項

### 9.1 Insecure Direct Object Reference (IDOR) 対策
すべてのリソースアクセスには必ず組織IDチェックを実施し、URLパラメーターの改ざんによる他組織データへのアクセスを防止する。

### 9.2 ログとモニタリング
アクセス権限エラーはすべてログに記録し、異常なアクセスパターンを検出できるようにする。

### 9.3 フロントエンドとバックエンドの両方での検証
アクセス制御はフロントエンドだけでなく、必ずバックエンドでも実施する。

## 10. 拡張性と将来的な考慮事項

現在は単一ロールを前提としていますが、将来的に以下のような拡張が考えられます：

1. **複数ロールの導入**: 上記で示した将来的なロール（ADMIN, MANAGER, READ_ONLY）の実装
2. **リソース単位の詳細な権限設定**: 特定のリソースタイプに対する特殊権限の設定
3. **カスタムロールの導入**: 組織ごとに独自のロールと権限設定が可能なシステム
4. **部署・グループベースのアクセス制御**: 大規模組織向けに組織内のさらなる分割

これらの拡張を念頭に置いた柔軟な設計とコード構造を維持することが重要です。

## 11. 参考実装

### 11.1 コントローラーの実装例
```typescript
// properties.controller.ts
import { Request, Response } from 'express';
import * as propertyService from './property.service';
import { ApiResponse, Property, PropertyCreateData } from '@shared/index';

// 物件一覧取得（自組織のみ）
export const getProperties = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user;
    const properties = await propertyService.getPropertiesByOrganization(organizationId);
    
    return res.json({
      success: true,
      data: properties
    } as ApiResponse<Property[]>);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '物件一覧の取得に失敗しました',
      code: 'GET_PROPERTIES_FAILED'
    } as ApiResponse<null>);
  }
};

// 物件作成（自組織として）
export const createProperty = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user;
    const propertyData: PropertyCreateData = req.body;
    
    // 組織IDを自動設定
    const property = await propertyService.createProperty({
      ...propertyData,
      organizationId
    });
    
    return res.status(201).json({
      success: true,
      data: property
    } as ApiResponse<Property>);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '物件の作成に失敗しました',
      code: 'CREATE_PROPERTY_FAILED'
    } as ApiResponse<null>);
  }
};
```