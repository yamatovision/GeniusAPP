// スコープデータ変換テスト - シンプル版

// 修正前の処理を再現
function oldImplementation(rawData) {
  console.log("\n--- OLD IMPLEMENTATION ---");
  try {
    // 文字列として扱い、常にJSON.parseを試みる
    const scopeData = rawData || '';
    console.log("Input data type:", typeof scopeData);
    
    if (scopeData) {
      try {
        const parsed = JSON.parse(scopeData);
        console.log("Parsed successfully:", parsed \!== null);
        return { success: true, data: parsed };
      } catch (error) {
        console.error("Parse error:", error.message);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "No data" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 修正後の処理を再現
function newImplementation(rawData) {
  console.log("\n--- NEW IMPLEMENTATION ---");
  try {
    // オブジェクトとして扱い、文字列の場合のみパースを試みる
    const scopeData = rawData || {};
    console.log("Input data type:", typeof scopeData);
    
    if (scopeData) {
      try {
        const parsed = typeof scopeData === 'string' ? JSON.parse(scopeData) : scopeData;
        console.log("Processed successfully:", parsed \!== null);
        return { success: true, data: parsed };
      } catch (error) {
        console.error("Processing error:", error.message);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "No data" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// テストケース
console.log("=== TEST 1: String JSON ===");
const stringData = '{"selectedItems":[{"id":"item1","title":"Task 1"}],"totalProgress":50}';
console.log("Old implementation result:", oldImplementation(stringData).success);
console.log("New implementation result:", newImplementation(stringData).success);

console.log("\n=== TEST 2: Object Data ===");
const objectData = {selectedItems:[{id:"item2",title:"Task 2"}],totalProgress:75};
console.log("Old implementation result:", oldImplementation(objectData).success);
console.log("New implementation result:", newImplementation(objectData).success);

console.log("\n=== TEST 3: Invalid Data - [object Object] ===");
const invalidStringData = "[object Object]";
console.log("Old implementation result:", oldImplementation(invalidStringData).success);
console.log("New implementation result:", newImplementation(invalidStringData).success);

console.log("\n=== TEST 4: Null Data ===");
console.log("Old implementation result:", oldImplementation(null).success);
console.log("New implementation result:", newImplementation(null).success);
