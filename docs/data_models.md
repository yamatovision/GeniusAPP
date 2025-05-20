# データモデル定義

## 基本モデル
あああああ
### ユーザーモデル (User)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | Integer | 一意のユーザーID | 主キー、自動採番 |
| name | String | ユーザー名 | 必須、最大100文字 |
| email | String | メールアドレス | 必須、一意、有効なメール形式 |
| password | String | パスワード（ハッシュ済） | 必須、最小8文字 |
| role | Enum | ユーザー権限 | 必須、'user'または'admin' |
| createdAt | Date | 作成日時 | 自動設定 |
| updatedAt | Date | 更新日時 | 自動更新 |

## プロンプト管理モデル

### プロンプトモデル (Prompt)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | UUID | プロンプトID | 主キー |
| title | String | プロンプトタイトル | 必須、最大200文字 |
| content | Text | プロンプト内容 | 必須 |
| type | Enum | プロンプトタイプ | 必須、'system', 'user', 'assistant', 'template' |
| category | String | カテゴリ | オプション |
| tags | Array<String> | 関連タグ | オプション |
| ownerId | UUID | 作成者ID | 外部キー(User) |
| projectId | UUID | プロジェクトID | 外部キー(Project) |
| isPublic | Boolean | 公開状態 | デフォルトfalse |
| createdAt | Date | 作成日時 | 自動設定 |
| updatedAt | Date | 更新日時 | 自動更新 |

### プロンプトバージョンモデル (PromptVersion)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | UUID | バージョンID | 主キー |
| promptId | UUID | プロンプトID | 外部キー(Prompt) |
| content | Text | バージョン内容 | 必須 |
| description | String | 変更説明 | オプション |
| versionNumber | Integer | バージョン番号 | 必須 |
| createdBy | UUID | 作成者ID | 外部キー(User) |
| createdAt | Date | 作成日時 | 自動設定 |

### プロジェクトモデル (Project)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | UUID | プロジェクトID | 主キー |
| name | String | プロジェクト名 | 必須、最大100文字 |
| description | Text | プロジェクト説明 | オプション |
| ownerId | UUID | オーナーID | 外部キー(User) |
| createdAt | Date | 作成日時 | 自動設定 |
| updatedAt | Date | 更新日時 | 自動更新 |

### プロンプト使用履歴 (PromptUsage)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | UUID | 履歴ID | 主キー |
| promptId | UUID | プロンプトID | 外部キー(Prompt) |
| versionId | UUID | バージョンID | 外部キー(PromptVersion) |
| userId | UUID | ユーザーID | 外部キー(User) |
| projectId | UUID | プロジェクトID | 外部キー(Project) |
| usedAt | Date | 使用日時 | 自動設定 |
| context | String | 使用コンテキスト | オプション |

### ユーザープロジェクト関連 (UserProject)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| userId | UUID | ユーザーID | 外部キー(User)、複合主キー |
| projectId | UUID | プロジェクトID | 外部キー(Project)、複合主キー |
| role | Enum | プロジェクト内役割 | 'owner', 'editor', 'viewer' |
| joinedAt | Date | 参加日時 | 自動設定 |

## 関連モデル

**User - Project (N:M)**
- ユーザーは複数のプロジェクトに所属
- プロジェクトは複数のユーザーを持つ
- UserProjectテーブルで関連を管理

**Project - Prompt (1:N)**
- プロジェクトは複数のプロンプトを持つ
- プロンプトは1つのプロジェクトに所属

**Prompt - PromptVersion (1:N)**
- プロンプトは複数のバージョンを持つ
- バージョンは1つのプロンプトに所属

**User - Prompt (1:N)**
- ユーザーは複数のプロンプトを作成可能
- プロンプトは1人の作成者を持つ

## 変更履歴

| 日付 | 変更者 | 変更内容 | 影響範囲 |
|------|-------|---------|---------|
| YYYY/MM/DD | 開発者名 | 初期モデル定義 | すべてのモデル |
| 2025/03/12 | AppGenius プロジェクトマネージャー | プロンプト管理モデルの追加 | Prompt, PromptVersion, Project, PromptUsage, UserProject |