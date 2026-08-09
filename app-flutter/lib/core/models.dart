/// 题目（/api/questions、/api/mistakes/redo 共用结构）
class Question {
  Question({
    required this.id,
    required this.question,
    required this.options,
    required this.answer,
    this.module,
    this.submodule,
    this.questionType,
    this.explanation,
    this.mistakeId,
    this.image,
    this.imageCredit,
    this.source,
    this.isReal = false,
    this.examYear,
    this.examRegion,
    this.groupSeq,
    this.hsExplanation,
    this.xpExplanation,
    this.xpSchool,
    this.attemptCount = 0,
    this.correctRatio,
    this.mostWrong,
  });

  final int? id;
  final String question;
  final Map<String, String> options;
  final String answer;
  final String? module;
  final String? submodule;
  final String? questionType;
  final String? explanation;
  final String? image;
  final String? imageCredit;
  final String? source;
  final bool isReal;
  final int? examYear;
  final String? examRegion;
  final int? groupSeq;
  final String? hsExplanation;
  final String? xpExplanation;
  final String? xpSchool;
  final int attemptCount;
  final int? correctRatio;
  final String? mostWrong;

  /// 错题重练/新存错题时对应的错题 id（错因自评需要）
  int? mistakeId;

  // 作答态
  String? picked;
  int secs = 0;
  bool logged = false;
  bool savedAsMistake = false;
  String? errorReason;
  bool reported = false;

  bool get answered => picked != null;
  bool get correct => normLetters(picked ?? '') == normLetters(answer);

  /// 多选题（答案含多个 A-D 字母，如「ABD」）
  bool get isMulti => normLetters(answer).length > 1;

  /// 提取并归一答案字母（去重排序），非字母答案原样返回
  static String normLetters(String s) {
    final m = RegExp(r'[A-D]+').firstMatch(s.toUpperCase());
    if (m == null) return s.trim().toUpperCase();
    final l = m.group(0)!.split('').toSet().toList()..sort();
    return l.join();
  }

  static Question fromJson(Map<String, dynamic> j, {int? mistakeId}) {
    final rawOpts = j['options'];
    final opts = <String, String>{};
    if (rawOpts is Map) {
      rawOpts.forEach((k, v) => opts[k.toString()] = v.toString());
    }
    return Question(
      id: j['id'] is int ? j['id'] as int : int.tryParse('${j['id']}'),
      question: (j['question'] ?? '').toString(),
      options: opts,
      answer: (j['answer'] ?? '').toString().trim(),
      module: j['module']?.toString(),
      submodule: j['submodule']?.toString(),
      questionType: j['question_type']?.toString(),
      explanation: j['explanation']?.toString(),
      mistakeId: mistakeId,
      image: j['image']?.toString(),
      imageCredit: j['image_credit']?.toString(),
      source: j['source']?.toString(),
      isReal: j['is_real'] == true || j['is_real'] == 1,
      examYear: j['exam_year'] is num ? (j['exam_year'] as num).toInt() : null,
      examRegion: j['exam_region']?.toString(),
      groupSeq: j['group_seq'] is num ? (j['group_seq'] as num).toInt() : null,
      hsExplanation: j['hs_explanation']?.toString(),
      xpExplanation: j['xp_explanation']?.toString(),
      xpSchool: j['xp_school']?.toString(),
      attemptCount: j['attempt_count'] is num ? (j['attempt_count'] as num).toInt() : 0,
      correctRatio: j['correct_ratio'] is num ? (j['correct_ratio'] as num).toInt() : null,
      mostWrong: j['most_wrong']?.toString(),
    );
  }
}

/// 错题（/api/mistakes 列表项）
class Mistake {
  Mistake({
    required this.id,
    required this.questionText,
    this.module,
    this.questionType,
    this.userAnswer,
    this.correctAnswer,
    this.explanation,
    this.errorReason,
    this.mastered = false,
    this.times = 1,
    this.createdAt = 0,
    this.questionId,
    this.tag3,
    this.tag3Name,
    this.nextReview,
  });

  final int id;
  final String questionText;
  final String? module;
  final String? questionType;
  final String? userAnswer;
  final String? correctAnswer;
  final String? explanation;
  final String? errorReason;
  bool mastered;
  final int times;
  final double createdAt;
  final int? questionId;

  /// 三级考点编码（后端联查 questions.tag3）
  final String? tag3;

  /// 三级考点名（后端联查 taxonomy）
  final String? tag3Name;

  /// 下次复习时间戳（遗忘曲线）
  final double? nextReview;

  static Mistake fromJson(Map<String, dynamic> j) => Mistake(
        id: j['id'] as int,
        questionText: (j['question_text'] ?? '').toString(),
        module: j['module']?.toString(),
        questionType: j['question_type']?.toString(),
        userAnswer: j['user_answer']?.toString(),
        correctAnswer: j['correct_answer']?.toString(),
        explanation: j['explanation']?.toString(),
        errorReason: j['error_reason']?.toString(),
        mastered: (j['mastered'] ?? 0) == 1,
        times: (j['times'] ?? 1) is int ? (j['times'] ?? 1) as int : 1,
        createdAt: (j['created_at'] is num) ? (j['created_at'] as num).toDouble() : 0,
        questionId: j['question_id'] is int ? j['question_id'] as int : null,
        tag3: j['tag3']?.toString(),
        tag3Name: j['tag3_name']?.toString(),
        nextReview:
            j['next_review'] is num ? (j['next_review'] as num).toDouble() : null,
      );
}
