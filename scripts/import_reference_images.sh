#!/usr/bin/env bash
set -euo pipefail

# 将任意来源参考图批量导入并重命名为 case-01.png, case-02.png ...
# 用法:
#   bash scripts/import_reference_images.sh "/path/to/source_images"

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/import_reference_images.sh \"/path/to/source_images\""
  exit 1
fi

SRC_DIR="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/assets/resources/references"

mkdir -p "$OUT_DIR"

index=1
for file in "$SRC_DIR"/*; do
  [ -f "$file" ] || continue
  case "${file##*.}" in
    png|PNG|jpg|JPG|jpeg|JPEG|webp|WEBP)
      printf -v name "case-%02d.png" "$index"
      cp "$file" "$OUT_DIR/$name"
      echo "Imported: $file -> $OUT_DIR/$name"
      index=$((index + 1))
      ;;
  esac
done

echo "Done. Imported $((index - 1)) images."
