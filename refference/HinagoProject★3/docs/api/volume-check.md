# ボリュームチェック関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-15  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）のボリュームチェック関連APIの詳細仕様を定義します。ボリュームチェックは、建築基準法や都市計画法に基づいた最大建築可能ボリュームの自動算出を中心とした機能で、システムの核となる機能です。

ボリュームチェックAPIは、物件データと建築パラメータに基づいて計算を実行し、結果を保存・取得する機能を提供します。また、計算結果の3Dモデル表示や容積消化率の計算も含まれます。

## 2. リソース概要

### 2.1 ボリュームチェック (VolumeCheck)

ボリュームチェックリソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| propertyId | ID | 関連物件ID |
| assetType | AssetType | アセットタイプ |
| buildingArea | number | 建築面積（㎡） |
| totalFloorArea | number | 延床面積（㎡） |
| buildingHeight | number | 建物高さ（m） |
| consumptionRate | number | 容積消化率（%） |
| floors | Floor[] | 階別情報 |
| model3dData | any | 3Dモデルデータ |
| createdAt | Date | 作成日時 |

### 2.2 階別情報 (Floor)

各階の面積情報を表します：

| 属性 | 型 | 説明 |
|-----|-----|------|
| level | number | 階数 |
| area | number | 床面積（㎡） |
| commonArea | number | 共用部面積（㎡） |
| privateArea | number | 専有部面積（㎡） |

### 2.3 建築パラメータ (BuildingParams)

ボリュームチェック計算のパラメータ：

| 属性 | 型 | 説明 |
|-----|-----|------|
| assetType | AssetType | アセットタイプ |
| floorHeight | number | 階高（m） |
| commonAreaRatio | number | 共用部率（%） |
| roadWidth | number | 前面道路幅員（m） |
| floors | number | 階数 |

### 2.4 アセットタイプ (AssetType)

建物種別を表す列挙型：

| 値 | 説明 |
|---|------|
| MANSION | マンション |
| OFFICE | オフィス |
| WOODEN_APARTMENT | 木造アパート |
| HOTEL | ホテル |

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/analysis/volume-check` | POST | 必須 | ボリュームチェック実行 |
| `/api/analysis/volume-check/{id}` | GET | 必須 | ボリュームチェック結果取得 |
| `/api/analysis/volume-check/{id}` | DELETE | 必須 | ボリュームチェック結果削除 |
| `/api/properties/{id}/volume-checks` | GET | 必須 | 物件のボリュームチェック一覧取得 |
| `/api/analysis/volume-check/{id}/export` | GET | 必須 | ボリュームチェック結果PDF出力 |
| `/api/analysis/volume-check/{id}/model` | GET | 必須 | 3Dモデルデータ取得 |

## 4. エンドポイント詳細

### 4.1 ボリュームチェック実行 - POST /api/analysis/volume-check

物件情報と建築パラメータに基づいてボリュームチェックを実行し、結果を保存します。

#### リクエスト

```json
{
  "propertyId": "property_123",
  "buildingParams": {
    "assetType": "mansion",
    "floorHeight": 3.2,
    "commonAreaRatio": 15,
    "roadWidth": 8,
    "floors": 12
  }
}
```

#### バリデーションルール

- `propertyId`: 必須、有効な物件ID
- `buildingParams`: 必須、建築パラメータオブジェクト
  - `assetType`: 必須、AssetType列挙型の有効な値
  - `floorHeight`: 必須、2.5～5.0の範囲内の数値
  - `commonAreaRatio`: 必須、0～50の範囲内の数値
  - `roadWidth`: オプション、正の数値（未指定時は物件の値を使用）
  - `floors`: 必須、1～50の範囲内の整数

#### レスポンス

**成功**: 201 Created
```json
{
  "success": true,
  "data": {
    "id": "vc_123",
    "propertyId": "property_123",
    "assetType": "mansion",
    "buildingArea": 400.4,
    "totalFloorArea": 4320.0,
    "buildingHeight": 38.4,
    "consumptionRate": 90,
    "floors": [
      {
        "level": 1,
        "area": 400.4,
        "commonArea": 60.06,
        "privateArea": 340.34
      },
      {
        "level": 2,
        "area": 380.0,
        "commonArea": 57.0,
        "privateArea": 323.0
      },
      // 他の階...
    ],
    "createdAt": "2025-05-15T12:00:00Z",
    "model3dData": {
      "url": "/api/analysis/volume-check/vc_123/model",
      "format": "three.js"
    }
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された物件が見つかりません"
  }
}
```

**エラー**: バリデーションエラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "buildingParams.floorHeight": "階高は2.5m～5.0mの範囲内で指定してください"
    }
  }
}
```

**エラー**: 計算エラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "CALCULATION_ERROR",
    "message": "ボリュームチェックの計算中にエラーが発生しました",
    "details": {
      "reason": "指定された階数では建築基準法の高さ制限に違反します"
    }
  }
}
```

#### 実装ノート

- 物件データと建築パラメータに基づいて最大建築可能ボリュームを計算
- 建築基準法の各種制限（建蔽率、容積率、斜線制限、日影規制等）を考慮
- 物件に敷地形状データがある場合は形状を考慮した正確な計算を実行
- 形状データがない場合は長方形敷地を仮定して概算
- 3Dモデルデータは簡易的な箱型モデルとして生成
- アセットタイプごとの標準的な共用部率を参考値として使用
- レート制限: 10回/分/ユーザー

---

### 4.2 ボリュームチェック結果取得 - GET /api/analysis/volume-check/{id}

指定されたIDのボリュームチェック結果を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ボリュームチェックID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| fields | string | いいえ | 取得するフィールドの指定（カンマ区切り） |
| include_model | boolean | いいえ | 3Dモデルデータを含めるか（デフォルト: false） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "vc_123",
    "propertyId": "property_123",
    "assetType": "mansion",
    "buildingArea": 400.4,
    "totalFloorArea": 4320.0,
    "buildingHeight": 38.4,
    "consumptionRate": 90,
    "floors": [
      {
        "level": 1,
        "area": 400.4,
        "commonArea": 60.06,
        "privateArea": 340.34
      },
      // 他の階...
    ],
    "createdAt": "2025-05-15T12:00:00Z",
    "model3dData": {
      "url": "/api/analysis/volume-check/vc_123/model",
      "format": "three.js"
    },
    "property": {
      "id": "property_123",
      "name": "福岡タワーマンション計画",
      "address": "福岡市中央区天神1-1-1"
    }
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- `fields`パラメータが指定された場合、指定されたフィールドのみが返却される
- `include_model=true`の場合、3Dモデルデータが含まれる（データ量が大きい場合があるため）
- デフォルトでは物件の基本情報（id, name, address）も含まれる
- レート制限: 60回/分/ユーザー

---

### 4.3 ボリュームチェック結果削除 - DELETE /api/analysis/volume-check/{id}

指定されたIDのボリュームチェック結果を削除します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ボリュームチェックID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "vc_123",
    "deleted": true
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- ボリュームチェック結果の削除は論理削除（ソフトデリート）として実装
- 関連するシナリオも削除マークされる
- 削除されたボリュームチェック結果は一覧取得では表示されなくなる
- レート制限: 10回/分/ユーザー

---

### 4.4 物件のボリュームチェック一覧取得 - GET /api/properties/{id}/volume-checks

指定された物件IDに関連するボリュームチェック結果の一覧を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| sort | string | いいえ | ソート条件（例: `createdAt:desc`） |
| assetType | string | いいえ | アセットタイプによるフィルタ（カンマ区切りで複数指定可） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "vc_123",
      "propertyId": "property_123",
      "assetType": "mansion",
      "buildingArea": 400.4,
      "totalFloorArea": 4320.0,
      "buildingHeight": 38.4,
      "consumptionRate": 90,
      "createdAt": "2025-05-15T12:00:00Z"
    },
    {
      "id": "vc_124",
      "propertyId": "property_123",
      "assetType": "office",
      "buildingArea": 400.4,
      "totalFloorArea": 4800.0,
      "buildingHeight": 48.0,
      "consumptionRate": 95,
      "createdAt": "2025-05-15T12:10:00Z"
    }
    // 他のボリュームチェック結果...
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 一覧取得では階別情報や3Dモデルデータは含まれない（概要情報のみ）
- 削除マークされたボリュームチェック結果は含まれない
- レート制限: 60回/分/ユーザー

---

### 4.5 ボリュームチェック結果PDF出力 - GET /api/analysis/volume-check/{id}/export

指定されたIDのボリュームチェック結果をPDF形式で出力します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ボリュームチェックID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| include_3d | boolean | いいえ | 3Dモデル画像を含めるか（デフォルト: true） |
| template | string | いいえ | PDFテンプレート（`simple`, `detailed`, `presentation`） |

#### レスポンス

**成功**: 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="volumecheck_result_{id}.pdf"

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- PDF生成はサーバーサイドで実行され、ダウンロード形式で提供
- PDF内容は物件情報、ボリュームチェック結果、3D画像、階別情報を含む
- テンプレートに応じてレイアウトやフォーマットが変更
- 3Dモデル画像は異なる角度から生成された静的画像
- レポートヘッダーには組織情報（名称等）が含まれる
- レート制限: 20回/時間/ユーザー

---

### 4.6 3Dモデルデータ取得 - GET /api/analysis/volume-check/{id}/model

指定されたIDのボリュームチェック結果の3Dモデルデータを取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ボリュームチェックID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| format | string | いいえ | モデル形式（`three.js`, `gltf`, `obj`）、デフォルト: `three.js` |

#### レスポンス

**成功**: 200 OK
Content-Type: application/json (three.js形式の場合)
```json
{
  "metadata": {
    "version": 4.5,
    "type": "Object",
    "generator": "HinagoProject"
  },
  "geometries": [
    // 3Dモデルのジオメトリデータ
  ],
  "materials": [
    // マテリアルデータ
  ],
  "object": {
    // シーングラフデータ
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

**エラー**: 未対応フォーマット - 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "指定されたモデル形式はサポートされていません"
  }
}
```

#### 実装ノート

- デフォルトではThree.js JSON形式で3Dモデルデータを提供
- モデルは敷地形状と箱型の建物モデルで構成
- フォーマット変換はサーバーサイドで実行
- モデルデータはキャッシュされ、再計算なしで提供
- レート制限: 60回/分/ユーザー

## 5. アセットタイプ情報

アセットタイプごとの標準情報は以下の通りです：

| アセットタイプ | 名称 | デフォルト階高 | 共用部率 | 標準容積消化率 |
|-------------|------|-------------|--------|--------------|
| MANSION | マンション | 3.2m | 15% | 90% |
| OFFICE | オフィス | 4.0m | 20% | 95% |
| WOODEN_APARTMENT | 木造アパート | 2.8m | 10% | 80% |
| HOTEL | ホテル | 3.5m | 25% | 85% |

これらの値はボリュームチェック計算時のデフォルト値として使用されますが、リクエスト時に上書き可能です。

## 6. 容積消化率計算

容積消化率は、建築基準法上の最大容積に対する実際に使用する容積の比率を表します：

```
容積消化率 = (総延床面積 / (敷地面積 × 容積率 / 100)) × 100
```

この比率は、アセットタイプごとの標準的な建築プランに基づいており、以下の要素を考慮しています：

- 各階の有効面積率
- 共用部や設備スペースの必要面積
- 構造的制約
- 駐車場・駐輪場の必要面積
- 住戸・オフィス区画の標準的なレイアウト効率

## 7. 建築基準法の制限

ボリュームチェック計算では、以下の建築基準法の制限が考慮されます：

1. **建蔽率制限**: 敷地面積に対する建築面積の比率上限
2. **容積率制限**: 敷地面積に対する延床面積の比率上限
3. **絶対高さ制限**: 用途地域や条例による高さの上限
4. **斜線制限**:
   - 道路斜線: 前面道路から一定の角度で立ち上がる斜線による制限
   - 隣地斜線: 隣地境界線から一定の角度で立ち上がる斜線による制限
   - 北側斜線: 北側隣地境界線から一定の角度で立ち上がる斜線による制限
5. **日影規制**: 隣地に落とす影の時間による制限

これらの制限は、敷地の用途地域、前面道路幅員、敷地形状など、物件データに基づいて適用されます。

## 8. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `VolumeCheckResult`: ボリュームチェック結果
- `BuildingParams`: 建築パラメータ
- `Floor`: 階別情報
- `AssetType`: アセットタイプ列挙型
- `AssetTypeInfo`: アセットタイプ情報

## 9. サンプルコード

### 9.1 ボリュームチェック実行

```typescript
// フロントエンドでのボリュームチェック実行例
import axios from 'axios';
import { API_PATHS, BuildingParams, AssetType } from '@shared/index';

// ボリュームチェック実行
const performVolumeCheck = async (propertyId: string, buildingParams: BuildingParams) => {
  try {
    const response = await axios.post(API_PATHS.ANALYSIS.VOLUME_CHECK, {
      propertyId,
      buildingParams
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('ボリュームチェックの実行に失敗しました', error);
    throw error;
  }
};

// 使用例
const runVolumeCheck = async () => {
  const result = await performVolumeCheck('property_123', {
    assetType: AssetType.MANSION,
    floorHeight: 3.2,
    commonAreaRatio: 15,
    floors: 12
  });
  
  console.log(`建築可能ボリューム: ${result.totalFloorArea}㎡`);
  console.log(`容積消化率: ${result.consumptionRate}%`);
};
```

### 9.2 3Dモデル表示

```typescript
// フロントエンドでの3Dモデル表示例（Three.js使用）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 3Dモデル表示
const display3DModel = async (volumeCheckId: string, containerId: string) => {
  try {
    // モデルデータ取得
    const response = await axios.get(
      `${API_PATHS.ANALYSIS.VOLUME_CHECK}/${volumeCheckId}/model`,
      { params: { format: 'three.js' } }
    );
    
    // Three.js初期化
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    
    // カメラ設定
    camera.position.set(50, 30, 50);
    camera.lookAt(0, 0, 0);
    
    // コントロール追加
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // ライト追加
    scene.add(new THREE.AmbientLight(0x404040));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // モデルローダー
    const loader = new THREE.ObjectLoader();
    const object = loader.parse(response.data);
    scene.add(object);
    
    // レンダリングループ
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();
    
    // リサイズハンドラ
    window.addEventListener('resize', () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    
    return { scene, camera, renderer };
  } catch (error) {
    console.error('3Dモデルの表示に失敗しました', error);
    throw error;
  }
};
```

## 10. セキュリティ考慮事項

### 10.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- ボリュームチェック結果は組織IDに基づいてアクセス制御
- 異なる組織のボリュームチェック結果にはアクセス不可

### 10.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- 特に建築パラメータは現実的な範囲でのみ受け付け
- 極端な値による計算リソース消費の防止

### 10.3 計算リソース保護

- 複雑な計算はジョブキューで非同期処理
- 計算時間の上限設定（30秒）
- 同時実行数の制限（組織あたり2件）

### 10.4 レート制限

- ボリュームチェック実行は10回/分/ユーザーに制限
- PDF出力は20回/時間/ユーザーに制限
- 模型データ取得は60回/分/ユーザーに制限

## 11. エラーハンドリング

一般的なボリュームチェック関連のエラーコード：

| エラーコード | 説明 |
|------------|------|
| `CALCULATION_ERROR` | ボリュームチェック計算中のエラー |
| `INVALID_PROPERTY_DATA` | 物件データが不完全または不正 |
| `SHAPE_DATA_REQUIRED` | 敷地形状データが必要な操作 |
| `UNSUPPORTED_FORMAT` | サポートされていない出力形式 |
| `EXPORT_GENERATION_ERROR` | PDF生成時のエラー |

## 12. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/analysis/volume-check/{id} | 15分 | ETagがサポート |
| GET /api/properties/{id}/volume-checks | 5分 | ETagがサポート |
| GET /api/analysis/volume-check/{id}/model | 1時間 | 変更なし |