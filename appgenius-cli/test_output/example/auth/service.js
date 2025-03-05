
/**
 * テスト用サービスクラス
 */
class TestService {
  constructor() {
    this.initialized = true;
  }
  
  async getData() {
    return { status: 'success' };
  }
}

module.exports = new TestService();
