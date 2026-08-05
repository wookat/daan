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
  bool get correct => picked == answer;

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
      );
}
