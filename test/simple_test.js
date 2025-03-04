// 最もシンプルなテスト

// テストケース
console.log("=== TEST 1: String JSON ===");
const stringData = '{"selectedItems":[{"id":"item1"}],"progress":50}';
console.log("Input type:", typeof stringData);

try {
  // 旧実装：文字列を常にJSON.parseする
  const oldResult = JSON.parse(stringData);
  console.log("Old implementation: Success");
} catch (error) {
  console.log("Old implementation: Failure -", error.message);
}

try {
  // 新実装：型チェックしてから処理
  const newResult = typeof stringData === 'string' ? JSON.parse(stringData) : stringData;
  console.log("New implementation: Success");
} catch (error) {
  console.log("New implementation: Failure -", error.message);
}

console.log("\n=== TEST 2: Object Data ===");
const objectData = {selectedItems:[{id:"item2"}],progress:75};
console.log("Input type:", typeof objectData);

try {
  // 旧実装：オブジェクトをJSON.parseしようとするとエラー
  const oldResult = JSON.parse(objectData);
  console.log("Old implementation: Success");
} catch (error) {
  console.log("Old implementation: Failure -", error.message);
}

try {
  // 新実装：型チェックしてから処理
  const newResult = typeof objectData === 'string' ? JSON.parse(objectData) : objectData;
  console.log("New implementation: Success");
} catch (error) {
  console.log("New implementation: Failure -", error.message);
}

console.log("\n=== TEST 3: [object Object] string ===");
const problemString = "[object Object]";
console.log("Input type:", typeof problemString);

try {
  // 旧実装：不正なJSONとしてパースしようとするとエラー
  const oldResult = JSON.parse(problemString);
  console.log("Old implementation: Success");
} catch (error) {
  console.log("Old implementation: Failure -", error.message);
}

try {
  // 新実装：型チェックするが、JSON.parseでエラー
  const newResult = typeof problemString === 'string' ? JSON.parse(problemString) : problemString;
  console.log("New implementation: Success");
} catch (error) {
  console.log("New implementation: Failure -", error.message);
}
