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

/// 语义色：同一 token 在浅色/深色下取不同值。
/// 直接引用 [KgColors] 的静态常量会把浅色值带进深色主题（白边、低对比文字），
/// 需要随主题变化的地方一律走 `context.kg`。
@immutable
class KgSemantic extends ThemeExtension<KgSemantic> {
  const KgSemantic({
    required this.t1,
    required this.t2,
    required this.t3,
    required this.t4,
    required this.border,
    required this.fill,
    required this.surface,
    required this.successBg,
    required this.errorBg,
    required this.warningBg,
    required this.brandBg,
  });

  final Color t1;
  final Color t2;
  final Color t3;
  final Color t4;
  final Color border;
  final Color fill;
  final Color surface;
  final Color successBg;
  final Color errorBg;
  final Color warningBg;
  final Color brandBg;

  static const light = KgSemantic(
    t1: KgColors.t1,
    t2: KgColors.t2,
    t3: KgColors.t3,
    t4: KgColors.t4,
    border: KgColors.border,
    fill: KgColors.fill,
    surface: Colors.white,
    successBg: KgColors.successBg,
    errorBg: KgColors.errorBg,
    warningBg: KgColors.warningBg,
    brandBg: KgColors.brand50,
  );

  static const dark = KgSemantic(
    t1: Color(0xFFF2F3F7),
    t2: Color(0xFFC7CAD4),
    t3: Color(0xFF9195A3),
    t4: Color(0xFF6E7280),
    border: Color(0xFF2A2D36),
    fill: Color(0xFF23262E),
    surface: Color(0xFF1A1C22),
    successBg: Color(0xFF13291D),
    errorBg: Color(0xFF2E1618),
    warningBg: Color(0xFF2B2110),
    brandBg: Color(0xFF1B2540),
  );

  @override
  KgSemantic copyWith({
    Color? t1,
    Color? t2,
    Color? t3,
    Color? t4,
    Color? border,
    Color? fill,
    Color? surface,
    Color? successBg,
    Color? errorBg,
    Color? warningBg,
    Color? brandBg,
  }) {
    return KgSemantic(
      t1: t1 ?? this.t1,
      t2: t2 ?? this.t2,
      t3: t3 ?? this.t3,
      t4: t4 ?? this.t4,
      border: border ?? this.border,
      fill: fill ?? this.fill,
      surface: surface ?? this.surface,
      successBg: successBg ?? this.successBg,
      errorBg: errorBg ?? this.errorBg,
      warningBg: warningBg ?? this.warningBg,
      brandBg: brandBg ?? this.brandBg,
    );
  }

  @override
  KgSemantic lerp(ThemeExtension<KgSemantic>? other, double t) {
    if (other is! KgSemantic) return this;
    return KgSemantic(
      t1: Color.lerp(t1, other.t1, t)!,
      t2: Color.lerp(t2, other.t2, t)!,
      t3: Color.lerp(t3, other.t3, t)!,
      t4: Color.lerp(t4, other.t4, t)!,
      border: Color.lerp(border, other.border, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      successBg: Color.lerp(successBg, other.successBg, t)!,
      errorBg: Color.lerp(errorBg, other.errorBg, t)!,
      warningBg: Color.lerp(warningBg, other.warningBg, t)!,
      brandBg: Color.lerp(brandBg, other.brandBg, t)!,
    );
  }
}

extension KgThemeX on BuildContext {
  KgSemantic get kg =>
      Theme.of(this).extension<KgSemantic>() ?? KgSemantic.light;
}

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
    extensions: [dark ? KgSemantic.dark : KgSemantic.light],
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
