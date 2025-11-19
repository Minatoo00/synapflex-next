import "server-only";
import { z } from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000";
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Synaplex";
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek/deepseek-chat-v3.1:free";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export type FollowUpQuestion = { id: string; text: string };
export type FollowUpAnswerMap = Record<string, { choice: string; text?: string }>; 
export type InteractionRound = {
  timestamp?: string;
  questions: FollowUpQuestion[];
  answers: FollowUpAnswerMap;
};

type LLMJSON = Record<string, unknown> & { error?: string };

const followUpQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const initialAnalysisSchema = z.object({
  brain_activity_candidates: z.array(z.string()).optional(),
  behavioral_pattern_candidates: z.array(z.string()).optional(),
  follow_up_questions: z.array(followUpQuestionSchema).optional(),
  initial_analysis_summary: z.string().optional(),
});

const finalAnalysisSchema = z.object({
  analysis: z
    .object({
      hypothesis: z.string(),
      neural_correlates: z.array(z.string()).optional(),
      suggestions: z.array(z.string()).optional(),
      summary: z.string().optional(),
    })
    .optional(),
});

const followupOutcomeSchema = z.object({
  status: z.enum(["completed", "pending_more_followup"]),
  analysis: finalAnalysisSchema.shape.analysis.optional(),
  next_questions: z.array(followUpQuestionSchema).optional(),
});

const personalizedSuggestionSchema = z.object({
  suggestions: z.array(z.string()),
});

async function callLLM(
  prompt: string,
  options?: { model?: string; temperature?: number; timeoutMs?: number }
): Promise<LLMJSON> {
  if (!OPENROUTER_API_KEY) {
    return { error: "OPENROUTER_API_KEY is not set" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 18000
  );

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": OPENROUTER_SITE_URL,
        "X-Title": OPENROUTER_SITE_NAME,
      },
      body: JSON.stringify({
        model: options?.model ?? LLM_MODEL,
        temperature: options?.temperature ?? 0.2,
        messages: [
          {
            role: "system",
            content:
              "あなたは認知科学と臨床神経科学の両面に精通した研究者です。ユーザーの状態を丁寧に理解し、JSONのみで回答して下さい。無関係なテキストや説明文は含めてはいけません。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { error: `OpenRouter error: ${response.status} ${errorBody}` };
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    return extractJSON(content);
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return { error: "LLM request timed out" };
    }
    return { error: `LLM request failed: ${(error as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(content: string): LLMJSON {
  const trimmed = content.trim();

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input) as LLMJSON;
    } catch (error) {
      return { error: (error as Error).message, raw: input } as LLMJSON;
    }
  };

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return tryParse(trimmed);
  }

  const fencedMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return tryParse(fencedMatch[1].trim());
  }

  const bracesMatch = trimmed.match(/\{[\s\S]*\}/);
  if (bracesMatch) {
    return tryParse(bracesMatch[0]);
  }

  return { error: "LLM response did not contain JSON", raw: trimmed } as LLMJSON;
}

function profileSection(profile: unknown): string {
  if (!profile || typeof profile !== "object") {
    return "ユーザープロフィール情報: なし";
  }

  const survey = (profile as Record<string, any>).initialSurvey ?? profile;
  const summary = {
    年齢: survey.age ?? "不明",
    性別: survey.gender ?? "不明",
    睡眠スコア: survey.sleepQuality ?? "不明",
    運動スコア: survey.exerciseHabit ?? "不明",
    認知スタイル: Array.isArray(survey.cognitiveStyle) && survey.cognitiveStyle.length
      ? survey.cognitiveStyle.join(", ")
      : "不明",
    集中しやすい時間帯: Array.isArray(survey.focusTime) && survey.focusTime.length
      ? survey.focusTime.join(", ")
      : "不明",
    期待するサポート: Array.isArray(survey.expectations) && survey.expectations.length
      ? survey.expectations.join(", ")
      : "不明",
  };

  return `ユーザープロフィール概要:\n${Object.entries(summary)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n")}`;
}

function historySection(history: InteractionRound[]): string {
  if (!history.length) {
    return "--- 対話履歴 ---\n(まだフォローアップ回答はありません)\n--- 対話履歴ここまで ---";
  }

  const rounds = history
    .map((round, index) => {
      const head = `\n<ラウンド ${index + 1}>`;
      const qMap = new Map(round.questions?.map((q) => [q.id, q.text]));
      const answers = Object.entries(round.answers ?? {})
        .map(([id, answer]) => {
          const question = qMap.get(id) ?? `質問(ID: ${id})`;
          const choice = answer.choice === "yes" ? "はい" : answer.choice === "no" ? "いいえ" : answer.choice;
          const text = answer.text ? `\n    補足: ${answer.text}` : "";
          return `- Q: ${question}\n  A: ${choice}${text}`;
        })
        .join("\n");

      return `${head}\n${answers || "- 回答なし"}`;
    })
    .join("\n");

  return `--- 対話履歴 ---${rounds}\n--- 対話履歴ここまで ---`;
}

export async function analyzeFeedbackAndGenerateQuestions(rawText: string, profile: unknown) {
  const prompt = [
    "以下のユーザーフィードバックとプロフィール情報を分析してください。",
    `ユーザーフィードバック: "${rawText}"`,
    profileSection(profile),
    `\n分析タスク (脳神経科学的な観点を重視してください):
1. フィードバック内容を分析し、関連する可能性のある脳活動や脳部位を特定してください。(brain_activity_candidates: 文字列配列)
2. フィードバック内容とプロフィール情報から、報告された認知的不調に関連しそうな具体的な行動パターンや状況を最大6つリストアップしてください。(behavioral_pattern_candidates: 文字列配列)
3. 各行動パターンについて、ユーザーが必ず「はい」か「いいえ」で明確に回答できる確認質問を生成してください。質問は過去形で記述し、ユニークなIDを付与してください (最大6つ)。
4. 脳機能との関連や考えられるメカニズムを含む初期要約を提供してください。(initial_analysis_summary)

出力は必ず次のJSON形式で返してください。
{
  "brain_activity_candidates": ["前頭前野", "海馬"],
  "behavioral_pattern_candidates": ["長時間の画面注視", "睡眠不足"],
  "follow_up_questions": [
    {"id": "q1", "text": "過去1週間で就寝前に90分以上デバイスを使用する日がありましたか？"}
  ],
  "initial_analysis_summary": "ユーザーは..."
}`,
  ].join("\n");

  const llmResponse = await callLLM(prompt);
  if (llmResponse.error) return llmResponse;

  const parsed = initialAnalysisSchema.safeParse(llmResponse);
  if (!parsed.success) {
    return { error: "LLM response validation failed", details: parsed.error.flatten() };
  }

  return parsed.data;
}

export async function processFollowupInteraction(
  rawText: string,
  profile: unknown,
  interactionHistory: InteractionRound[],
  currentQuestions: FollowUpQuestion[],
  currentAnswers: FollowUpAnswerMap
) {
  const historyWithCurrent = [
    ...interactionHistory,
    { questions: currentQuestions, answers: currentAnswers },
  ];

  const prompt = [
    "あなたは認知科学にも精通した脳神経科学者です。以下の情報を統合的に分析してください。",
    `ユーザー初期フィードバック: "${rawText}"`,
    profileSection(profile),
    historySection(historyWithCurrent),
    `\n分析タスク:
1. 現時点で信頼できる原因仮説と科学的根拠を提示できるか判断してください。
2. 十分な情報がある場合は status を "completed" とし、仮説(hypothesis)と改善策(suggestions: 3〜5個)を生成してください。改善策には脳科学的な理由を括弧で添えてください。
3. まだ情報が不足している場合は status を "pending_more_followup" とし、最大3つまでの追加質問(next_questions)を生成してください。質問は必ずはい/いいえで答えられる具体的な確認問いにしてください。既出の質問と重複させないでください。

出力は必ず次の形式に従ってください。
{
  "status": "completed" | "pending_more_followup",
  "analysis": {
    "hypothesis": "...",
    "suggestions": ["改善策 (理由: ...)", "..."]
  },
  "next_questions": [
    {"id": "nq1", "text": "..."}
  ]
}`,
  ].join("\n");

  const llmResponse = await callLLM(prompt, { temperature: 0.25 });
  if (llmResponse.error) return llmResponse;

  const parsed = followupOutcomeSchema.safeParse(llmResponse);
  if (!parsed.success) {
    return { error: "LLM response validation failed", details: parsed.error.flatten() };
  }

  return parsed.data;
}

export async function generateFinalAnalysis(
  rawText: string,
  profile: unknown,
  interactionHistory: InteractionRound[]
) {
  const prompt = [
    "以下の情報にもとづき、最終的な原因仮説と改善提案をまとめてください。",
    `ユーザー初期フィードバック: "${rawText}"`,
    profileSection(profile),
    historySection(interactionHistory),
    `\n期待される出力:
{
  "analysis": {
    "hypothesis": "原因仮説",
    "neural_correlates": ["推定される脳部位やネットワーク"],
    "suggestions": ["改善策 (理由: 脳科学的根拠)"],
    "summary": "短いまとめ"
  }
}`,
  ].join("\n");

  const llmResponse = await callLLM(prompt);
  if (llmResponse.error) return llmResponse;

  const parsed = finalAnalysisSchema.safeParse(llmResponse);
  if (!parsed.success) {
    return { error: "LLM response validation failed", details: parsed.error.flatten() };
  }

  return parsed.data;
}

export async function personalizeSuggestions(hypothesis: string, selectedTypes: string[]) {
  const typeMap: Record<string, string> = {
    physicalCare: "身体ケア",
    mentalTechniques: "思考テクニック",
    behaviorHabitDesign: "行動・習慣デザイン",
    environmentalManagement: "環境マネジメント",
    emotionalSocialSkills: "感情・対人スキル",
    learningUnderstanding: "学びと理解",
  };

  const readableTypes = selectedTypes
    .map((type) => typeMap[type] ?? type)
    .join(", ");

  const prompt = `原因仮説:\n\n${hypothesis}\n\nユーザーが特に関心のある改善策タイプ: ${readableTypes}\n\n上記の仮説とタイプに沿って、実行可能で科学的根拠のある改善提案を3〜5個生成してください。各改善策には簡潔な理由(脳科学的視点)と、関連するタイプ名を括弧内に含め、以下の形式で回答してください。\n\n{
  "suggestions": [
    "改善策 (タイプ: 身体ケア, 理由: ...)",
    "..."
  ]
}`;

  const llmResponse = await callLLM(prompt, { temperature: 0.4 });
  if (llmResponse.error) return llmResponse;

  const parsed = personalizedSuggestionSchema.safeParse(llmResponse);
  if (!parsed.success) {
    return { error: "LLM response validation failed", details: parsed.error.flatten() };
  }

  return parsed.data;
}
