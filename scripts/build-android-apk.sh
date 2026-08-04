#!/usr/bin/env bash
# 考公错题助手 —— Android APK 离线打包（uni-app app-plus + DCloud 离线 SDK + gradle）
#
# 用法：
#   UNI_SDK_DIR=/path/to/Android-SDK ANDROID_HOME=$HOME/android-sdk ./scripts/build-android-apk.sh
#
# 依赖：
#   - Node 18+ / npm（编译 uni-app app 资源）
#   - JDK 17、Android SDK（platforms;android-35、build-tools;35.0.0）
#   - DCloud Android 离线 SDK（nativesupport.dcloud.net.cn/AppDocs/download/android），
#     解压后目录内含 HBuilder-Integrate-AS 壳工程；用 UNI_SDK_DIR 指向该解压目录。
#
# 产物：dist/kaogong-assistant-debug.apk（debug 签名，未做正式签名/加固）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$REPO_ROOT/frontend-uni"
APPID="__UNI__KAOGONG"           # 与 frontend-uni/src/manifest.json 的 appid 保持一致
UNI_SDK_DIR="${UNI_SDK_DIR:?请设置 UNI_SDK_DIR 指向 DCloud Android 离线 SDK 解压目录}"
SHELL_PROJ="$UNI_SDK_DIR/HBuilder-Integrate-AS"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/dist}"

echo "==> 1/4 编译 app-plus 资源"
cd "$FRONTEND"
[ -d node_modules ] || npm ci
npx uni build -p app

echo "==> 2/4 注入 App 资源到壳工程 ($SHELL_PROJ)"
ASSETS="$SHELL_PROJ/simpleDemo/src/main/assets"
rm -rf "$ASSETS/apps"/*
mkdir -p "$ASSETS/apps/$APPID/www"
cp -r "$FRONTEND/dist/build/app/." "$ASSETS/apps/$APPID/www/"
cat > "$ASSETS/data/dcloud_control.xml" <<EOF
<hbuilder>
<apps>
    <app appid="$APPID" appver=""/>
</apps>
</hbuilder>
EOF

echo "==> 3/4 应用名 / 包名"
sed -i 's|<string name="app_name">.*</string>|<string name="app_name">考公错题助手</string>|' \
  "$SHELL_PROJ/simpleDemo/src/main/res/values/strings.xml"
sed -i 's|applicationId "com.android.simple"|applicationId "com.zalize.kaogong"|' \
  "$SHELL_PROJ/simpleDemo/build.gradle"

echo "==> 4/4 gradle assembleDebug"
cd "$SHELL_PROJ"
echo "sdk.dir=${ANDROID_HOME:?请设置 ANDROID_HOME}" > local.properties
./gradlew :simpleDemo:assembleDebug

mkdir -p "$OUT_DIR"
cp simpleDemo/build/outputs/apk/debug/simpleDemo-debug.apk "$OUT_DIR/kaogong-assistant-debug.apk"
echo "APK => $OUT_DIR/kaogong-assistant-debug.apk"
