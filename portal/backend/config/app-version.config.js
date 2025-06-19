/**
 * アプリケーションバージョン管理設定
 * 
 * このファイルは認証トークンのバージョン管理を行います。
 * 最小許可バージョンを更新することで、古いバージョンのクライアントを
 * 強制的にログアウトさせることができます。
 */

module.exports = {
  // 現在のアプリケーションバージョン
  // このバージョンが新規発行されるトークンに含まれます
  currentVersion: '2.0.0',
  
  // 許可する最小バージョン
  // これより古いバージョンのトークンは拒否されます
  minimumAllowedVersion: '2.0.0',
  
  // バージョン比較関数
  // セマンティックバージョニング形式（major.minor.patch）に対応
  isVersionAllowed: function(tokenVersion) {
    if (!tokenVersion) {
      // バージョン情報がないトークンは旧バージョンとして拒否
      return false;
    }
    
    const parseVersion = (version) => {
      const parts = version.split('.');
      return {
        major: parseInt(parts[0] || 0),
        minor: parseInt(parts[1] || 0),
        patch: parseInt(parts[2] || 0)
      };
    };
    
    const token = parseVersion(tokenVersion);
    const minimum = parseVersion(this.minimumAllowedVersion);
    
    // メジャーバージョンの比較
    if (token.major < minimum.major) return false;
    if (token.major > minimum.major) return true;
    
    // マイナーバージョンの比較
    if (token.minor < minimum.minor) return false;
    if (token.minor > minimum.minor) return true;
    
    // パッチバージョンの比較
    if (token.patch < minimum.patch) return false;
    
    return true;
  },
  
  // エラーレスポンス設定
  versionError: {
    code: 'VERSION_OUTDATED',
    message: '新しいバージョンのアプリケーションが利用可能です。再度ログインしてください。',
    requireUpdate: true
  }
};