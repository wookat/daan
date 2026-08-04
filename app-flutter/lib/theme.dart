import 'package:flutter/material.dart';

/// design-v3 DESIGN.md tokens
class KgColors {
  static const brand = Color(0xFF3B6FF5);
  static const brandDeep = Color(0xFF2F5CD8);
  static const brand50 = Color(0xFFEDF3FE);
  static const brand100 = Color(0xFFDCE7FD);
  static const gradStart = Color(0xFF5B8AF8);
  static const success = Color(0xFF16A34A);
  static const successBg = Color(0xFFECFDF5);
  static const error = Color(0xFFDC2626);
  static const errorBg = Color(0xFFFEF2F2);
  static const warning = Color(0xFFD97706);
  static const warningBg = Color(0xFFFFFBEB);
  static const t1 = Color(0xFF17181C);
  static const t2 = Color(0xFF40434E);
  static const t3 = Color(0xFF7D818F);
  static const t4 = Color(0xFFB0B4C0);
  static const border = Color(0xFFE7E9F0);
  static const fill = Color(0xFFF2F3F7);
  static const bg = Color(0xFFF6F7FB);

  static const moduleColors = <String, Color>{
    'ziliao': Color(0xFF0D9488),
    'shuliang': Color(0xFF3B6FF5),
    'yanyu': Color(0xFFE11D48),
    'panduan': Color(0xFF7C3AED),
    'changshi': Color(0xFFD97706),
  };
}

const kBrandGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [KgColors.gradStart, KgColors.brand],
);

ThemeData kgTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: KgColors.brand,
    brightness: brightness,
    primary: KgColors.brand,
    surface: dark ? const Color(0xFF121318) : Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? const Color(0xFF0C0D11) : KgColors.bg,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xFF121318) : Colors.white,
      foregroundColor: dark ? Colors.white : KgColors.t1,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: dark ? Colors.white : KgColors.t1,
      ),
    ),
    cardTheme: CardThemeData(
      color: dark ? const Color(0xFF1A1C22) : Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: KgColors.brand,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    chipTheme: ChipThemeData(
      selectedColor: dark ? KgColors.brandDeep : KgColors.brand50,
      shape: const StadiumBorder(),
      side: BorderSide(color: dark ? const Color(0xFF2A2D36) : KgColors.border),
    ),
    dividerTheme: DividerThemeData(
      color: dark ? const Color(0xFF2A2D36) : KgColors.border,
      thickness: 1,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF121318) : Colors.white,
      indicatorColor: dark ? KgColors.brandDeep : KgColors.brand50,
      height: 64,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),
  );
}

const kModuleNames = <String, String>{
  'ziliao': '资料分析',
  'shuliang': '数量关系',
  'yanyu': '言语理解',
  'panduan': '判断推理',
  'changshi': '常识判断',
};

String moduleName(String? key) {
  if (key == null || key.isEmpty) return '行测';
  return kModuleNames[key] ?? key;
}
