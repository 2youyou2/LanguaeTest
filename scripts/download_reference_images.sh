#!/usr/bin/env bash
set -euo pipefail

# 下载公开网页参考图，并按 case-XX 命名，供 Cocos resources 自动加载
# 用法:
#   bash scripts/download_reference_images.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/assets/resources/references"

mkdir -p "$OUT_DIR"

download() {
  local url="$1"
  local name="$2"
  echo "Downloading: $url -> $name"
  curl -L --fail --silent --show-error "$url" -o "$OUT_DIR/$name"
}

# 这些是公开可访问的参考图，主要用于“视觉对照面板”流程验证。
# 你可以把它们替换成更贴近具体语言用例的截图 URL。
download "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Unicode_logo.svg/640px-Unicode_logo.svg.png" "case-01.png"
download "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Globe_icon.svg/640px-Globe_icon.svg.png" "case-02.png"
download "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/640px-The_Earth_seen_from_Apollo_17.jpg" "case-03.png"

echo "Done. Images saved to: $OUT_DIR"
echo "Tip: 文件名按 case-01.png、case-02.png... 递增，脚本会按名称排序加载。"
