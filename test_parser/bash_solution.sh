#!/bin/bash

# ディレクトリ構造テキストを処理するシンプルなスクリプト
process_tree() {
  # ファイルから読み込むか、引数から読み込むか
  if [ -f "$1" ]; then
    input=$(cat "$1")
  else
    input="$1"
  fi
  
  # 一時ファイルに保存
  echo "$input" > temp_tree.txt
  
  # ルートディレクトリ名を抽出
  root_dir=$(head -n 1 temp_tree.txt | grep -o '^[^/]*/' | sed 's|/||')
  echo "ルートディレクトリ: $root_dir"
  
  # 本体の処理
  # 1. 先頭行（ルートディレクトリ）を削除
  # 2. すべての記号と余分なスペースを削除
  # 3. ディレクトリ構造を抽出
  {
    echo "すべてのパス:"
    tail -n +2 temp_tree.txt | 
      sed -E 's/^[│├└─+|\\]*\s*//' |     # 先頭の記号を削除
      sed -E 's/[│├└─+|\\]//g' |         # すべての記号を削除
      awk '{
        indent = 0;
        for(i=1; i<=length($0); i++) {
          if(substr($0,i,1) == " ") indent++;
          else break;
        }
        level = int(indent/2);            # インデントレベルを計算
        name = $0;
        gsub(/^ */, "", name);            # 先頭のスペースを削除
        
        # ディレクトリかどうかを判定
        is_dir = (substr(name, length(name), 1) == "/");
        if(is_dir) name = substr(name, 1, length(name)-1);  # 末尾の/を削除
        
        # インデントレベルに基づいてパスを構築
        while(stack_level > level) {
          stack_level--;
          delete path_stack[stack_level];
        }
        
        if(is_dir) {
          path_stack[level] = name;
          stack_level = level + 1;
        } else {
          # パスを構築
          path = "";
          for(i=0; i<level; i++) {
            if(path_stack[i] != "") {
              if(path != "") path = path "/";
              path = path path_stack[i];
            }
          }
          if(path != "") path = path "/";
          path = path name;
          
          if("'"$root_dir"'" != "") path = "'"$root_dir"'/" path;
          print path;
        }
      }' 
    
  } > extracted_paths.txt
  
  # 結果を表示
  cat extracted_paths.txt
  
  # テンポラリファイルを削除
  rm temp_tree.txt
}

# テスト用のデータ
test1='
myproject/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Button.jsx
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── About.jsx
│   │   └── app.jsx
│   └── styles/
│       ├── global.css
│       └── components.css
├── public/
│   ├── index.html
│   └── favicon.ico
└── package.json
'

# テスト実行
echo "======= テスト実行 ======="
process_tree "$test1"

# 使用例:
# ./bash_solution.sh
# または
# ./bash_solution.sh tree_file.txt