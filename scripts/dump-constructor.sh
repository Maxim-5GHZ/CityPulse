#!/bin/bash
# Дамп исходников конструктора «Обнинск 2040» в один файл (для ревью/LLM).
# Что входит:
# - движок: frontend/lib/city/*.ts, frontend/lib/city-engine/*.ts
# - построение путей: dijkstra.ts, routeTool.ts, graph.ts, RouteContextMenu.tsx
#   (лежат внутри движка выше, отдельно не перечисляем)
# - 3D: frontend/components/city/City3D.tsx, DistrictMap3D.tsx, DeckCityView.tsx,
#   3d/meshes.ts, 3d/simulation.ts, lib/city/three-factory.ts (тоже внутри списков)
# - весь конструктор: frontend/components/city/**, frontend/app/workspace/**,
#   конвейер OSM scripts/osm-to-district.mjs, персист бэка (Scenario/Project),
#   клиент lib/scenarios.ts + lib/projectApi.ts + frontend/package.json (версии three/deck.gl/ol).
# Секреты НЕ дампятся: только исходники из явного списка, без .env/сертов.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="${1:-$ROOT/constructor_dump.txt}"
> "$OUTPUT_FILE"

echo "# CityPulse constructor dump: engine + routing + 3D" >> "$OUTPUT_FILE"
echo "# date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTPUT_FILE"
echo "# git: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

LIST_FILE="$(mktemp)"
trap 'rm -f "$LIST_FILE"' EXIT

# 1) Движок + вью конструктора + экраны workspace (только .ts/.tsx, без node_modules/.next).
find \
  "$ROOT/frontend/lib/city" \
  "$ROOT/frontend/lib/city-engine" \
  "$ROOT/frontend/components/city" \
  "$ROOT/frontend/app/workspace" \
  -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  2>/dev/null | sort >> "$LIST_FILE"

# 2) Точечные файлы: конвейер OSM, клиент персиста, версии 3D-зависимостей, персист бэка.
for f in \
  "$ROOT/scripts/osm-to-district.mjs" \
  "$ROOT/frontend/lib/scenarios.ts" \
  "$ROOT/frontend/lib/projectApi.ts" \
  "$ROOT/frontend/package.json" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/controller/ScenarioController.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/controller/ProjectController.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/domain/DistrictScenario.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/domain/Scenario.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/domain/Project.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/repository/DistrictScenarioRepository.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/repository/ScenarioRepository.java" \
  "$ROOT/backend/src/main/java/ru/citypulse/backend/repository/ProjectRepository.java" \
; do
  if [ -f "$f" ]; then
    echo "$f" >> "$LIST_FILE"
  else
    echo "WARN: missing $f" >&2
  fi
done

sort -u "$LIST_FILE" -o "$LIST_FILE"

COUNT=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  rel="${file#$ROOT/}"
  echo "File: $rel" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  echo -e "\n\n============================================================\n\n" >> "$OUTPUT_FILE"
  COUNT=$((COUNT + 1))
done < "$LIST_FILE"

echo "Dumped $COUNT files into $OUTPUT_FILE"
