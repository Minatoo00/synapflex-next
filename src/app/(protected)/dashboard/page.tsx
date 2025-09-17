"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type {
  FollowUpQuestion,
  FollowUpAnswerMap,
} from "@/lib/llm";

const suggestionTypes = [
  { id: "physicalCare", label: "身体ケア" },
  { id: "mentalTechniques", label: "思考テクニック" },
  { id: "behaviorHabitDesign", label: "行動・習慣デザイン" },
  { id: "environmentalManagement", label: "環境マネジメント" },
  { id: "emotionalSocialSkills", label: "感情・対人スキル" },
  { id: "learningUnderstanding", label: "学びと理解" },
] as const;

type HistoryItem = {
  id: string;
  createdAt: string;
  feedbackText: string;
  status: "PENDING_FOLLOWUP" | "PENDING_ADDITIONAL" | "COMPLETED";
  initialAnalysis?: {
    initial_analysis_summary?: string;
    brain_activity_candidates?: string[];
    behavioral_pattern_candidates?: string[];
  };
  analysisResult?: {
    hypothesis?: string;
    suggestions?: string[];
    summary?: string;
  };
  personalizedSuggestions?: {
    suggestions?: string[];
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [feedbackText, setFeedbackText] = useState("");
  const [currentFeedbackId, setCurrentFeedbackId] = useState<string | null>(null);
  const [initialInsights, setInitialInsights] = useState<Record<string, unknown> | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [personalized, setPersonalized] = useState<string[] | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<FollowUpQuestion[]>([]);
  const [answerDraft, setAnswerDraft] = useState<FollowUpAnswerMap>({});
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [personalizeLoading, setPersonalizeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!session?.user) {
      router.push("/login");
    } else if (!session.user.surveyCompleted) {
      router.push("/initial-survey");
    }
  }, [session, router]);

  const fetchHistory = async () => {
    const response = await fetch("/api/feedback");
    if (!response.ok) return;
    const data = await response.json();
    setHistory(data.history ?? []);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const resetConversationState = () => {
    setInitialInsights(null);
    setAnalysisResult(null);
    setPersonalized(null);
    setPendingQuestions([]);
    setAnswerDraft({});
    setSelectedTypes([]);
    setSelectedHistory(null);
  };

  const handleFeedbackSubmit = async () => {
    setError(null);
    if (!feedbackText.trim()) {
      setError("フィードバックを入力してください。");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: feedbackText.trim() }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message = typeof data.error === "string" ? data.error : "解析に失敗しました";
      setError(message);
      return;
    }

    setFeedbackText("");
    setCurrentFeedbackId(data.feedbackId);
    setInitialInsights({
      initial_analysis_summary: data.initial_analysis_summary,
      brain_activity_candidates: data.brain_activity_candidates,
      behavioral_pattern_candidates: data.behavioral_pattern_candidates,
    });
    setPendingQuestions(data.follow_up_questions ?? []);
    setAnswerDraft({});
    setAnalysisResult(data.analysis ?? null);
    setSelectedHistory(null);
    fetchHistory();
  };

  const handleAnswer = (questionId: string, choice: "yes" | "no") => {
    setAnswerDraft((prev) => ({
      ...prev,
      [questionId]: {
        choice,
        text: prev[questionId]?.text,
      },
    }));
  };

  const handleAnswerNote = (questionId: string, text: string) => {
    setAnswerDraft((prev) => ({
      ...prev,
      [questionId]: {
        choice: prev[questionId]?.choice ?? "yes",
        text,
      },
    }));
  };

  const allQuestionsAnswered = useMemo(() => {
    if (!pendingQuestions.length) return false;
    return pendingQuestions.every((question) =>
      answerDraft[question.id]?.choice === "yes" || answerDraft[question.id]?.choice === "no"
    );
  }, [pendingQuestions, answerDraft]);

  const handleSendFollowUp = async () => {
    if (!currentFeedbackId) {
      setError("フィードバックIDが見つかりません。");
      return;
    }

    if (!allQuestionsAnswered) {
      setError("すべての質問に回答してください。");
      return;
    }

    setFollowUpLoading(true);
    const response = await fetch("/api/feedback/followup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId: currentFeedbackId, answers: answerDraft }),
    });

    const data = await response.json();
    setFollowUpLoading(false);

    if (!response.ok) {
      const message = typeof data.error === "string" ? data.error : "フォローアップ処理に失敗しました";
      setError(message);
      return;
    }

    if (data.analysis) {
      setAnalysisResult(data.analysis);
      setPendingQuestions([]);
      setAnswerDraft({});
      setPersonalized(null);
      setSelectedTypes([]);
    } else {
      setPendingQuestions(data.follow_up_questions ?? []);
      setAnswerDraft({});
    }

    fetchHistory();
  };

  const toggleSuggestionType = (id: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(id)) {
        return prev.filter((type) => type !== id);
      }
      return [...prev, id];
    });
  };

  const handlePersonalize = async () => {
    if (!currentFeedbackId && !selectedHistory?.id) {
      setError("パーソナライズの対象が見つかりません");
      return;
    }
    const targetId = currentFeedbackId ?? selectedHistory?.id;
    if (!targetId) return;

    setPersonalizeLoading(true);
    const response = await fetch("/api/feedback/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId: targetId, selectedTypes }),
    });

    const data = await response.json();
    setPersonalizeLoading(false);

    if (!response.ok) {
      const message = typeof data.error === "string" ? data.error : "提案の生成に失敗しました";
      setError(message);
      return;
    }

    setPersonalized(data.suggestions ?? []);
    fetchHistory();
  };

  const handleSelectHistory = (item: HistoryItem) => {
    resetConversationState();
    setSelectedHistory(item);
    setCurrentFeedbackId(item.id);
    if (item.analysisResult) {
      setAnalysisResult(item.analysisResult);
    }
    if (item.personalizedSuggestions?.suggestions) {
      setPersonalized(item.personalizedSuggestions.suggestions);
    }
    if (item.initialAnalysis) {
      setInitialInsights(item.initialAnalysis as Record<string, unknown>);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    await fetch(`/api/feedback/history/${id}`, { method: "DELETE" });
    if (selectedHistory?.id === id) {
      resetConversationState();
      setCurrentFeedbackId(null);
    }
    fetchHistory();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.8fr,1fr]">
      <section className="space-y-6">
        <div className="rounded-3xl border border-white/50 bg-panel/90 p-6 shadow-elevated">
          <h2 className="text-xl font-semibold text-ink">今日のフィードバック</h2>
          <p className="mt-2 text-sm text-ink-muted">
            集中力や思考の変化、体調の揺らぎなど気づいたことを教えてください。Appleのヒューマンインターフェイスガイドに沿った静かなカードUIで丁寧にヒアリングします。
          </p>
          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            rows={6}
            className="mt-4 w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-sm text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
            placeholder="例: 午後になると集中が続かず、小さな確認ミスが増えた気がします..."
          />
          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              onClick={handleFeedbackSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-ink/90 focus:outline-none focus:ring-4 focus:ring-ink/20 disabled:opacity-60"
            >
              {loading ? "解析中..." : "解析を開始"}
            </button>
          </div>
        </div>

        {initialInsights && (
          <div className="rounded-3xl border border-white/50 bg-panel/90 p-6 shadow-elevated space-y-4">
            <h3 className="text-lg font-semibold text-ink">初期インサイト</h3>
            {initialInsights.initial_analysis_summary && (
              <p className="text-sm leading-relaxed text-ink">
                {initialInsights.initial_analysis_summary as string}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <InsightList
                title="関連が考えられる脳部位"
                items={(initialInsights.brain_activity_candidates as string[]) ?? []}
              />
              <InsightList
                title="着目すべき行動パターン"
                items={(initialInsights.behavioral_pattern_candidates as string[]) ?? []}
              />
            </div>
          </div>
        )}

        {pendingQuestions.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-panel/90 p-6 shadow-elevated space-y-4">
            <h3 className="text-lg font-semibold text-ink">確認したいポイント</h3>
            <p className="text-sm text-ink-muted">
              各質問は「はい / いいえ」で回答できます。必要に応じて補足を追加してください。
            </p>
            <div className="space-y-4">
              {pendingQuestions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-white/40 bg-panel/60 p-4 shadow-soft space-y-3">
                  <p className="text-sm font-medium text-ink">{question.text}</p>
                  <div className="flex gap-3">
                    {(["yes", "no"] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleAnswer(question.id, choice)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          answerDraft[question.id]?.choice === choice
                            ? "bg-ink text-white shadow-soft"
                            : "bg-white/70 text-ink border border-white/50"
                        }`}
                      >
                        {choice === "yes" ? "はい" : "いいえ"}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={answerDraft[question.id]?.text ?? ""}
                    onChange={(event) => handleAnswerNote(question.id, event.target.value)}
                    placeholder="補足があればご記入ください"
                    rows={2}
                    className="w-full rounded-2xl border border-white/30 bg-white/60 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSendFollowUp}
                disabled={!allQuestionsAnswered || followUpLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-ink/90 focus:outline-none focus:ring-4 focus:ring-ink/20 disabled:opacity-60"
              >
                {followUpLoading ? "送信中..." : "回答を送信"}
              </button>
            </div>
          </div>
        )}

        {analysisResult && (
          <div className="rounded-3xl border border-white/50 bg-panel/90 p-6 shadow-elevated space-y-5">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">最終分析</h3>
              {analysisResult.summary && (
                <p className="text-sm text-ink-muted leading-relaxed">
                  {analysisResult.summary as string}
                </p>
              )}
            </div>
            {analysisResult.hypothesis && (
              <div className="rounded-2xl border border-white/40 bg-panel/60 p-4 shadow-soft">
                <h4 className="text-sm font-semibold text-ink">原因仮説</h4>
                <p className="mt-2 text-sm text-ink leading-relaxed">
                  {analysisResult.hypothesis as string}
                </p>
              </div>
            )}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-ink">提案されるアクション</h4>
              <ul className="space-y-3">
                {Array.isArray(analysisResult.suggestions) ? (
                  (analysisResult.suggestions as string[]).map((suggestion, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-ink shadow-soft"
                    >
                      {suggestion}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-ink-muted">提案が生成されませんでした。</li>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-ink-muted">改善策をさらに自分に合う形で調整しますか？</p>
              <div className="flex flex-wrap gap-2">
                {suggestionTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleSuggestionType(type.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedTypes.includes(type.id)
                        ? "bg-accent text-white shadow-soft"
                        : "bg-white/70 text-ink border border-white/50"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handlePersonalize}
                disabled={selectedTypes.length === 0 || personalizeLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-ink/90 focus:outline-none focus:ring-4 focus:ring-ink/20 disabled:opacity-60"
              >
                {personalizeLoading ? "カスタマイズ中..." : "選択内容で提案を調整"}
              </button>
            </div>

            {personalized && personalized.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-ink">パーソナライズ提案</h4>
                <ul className="space-y-3">
                  {personalized.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-ink shadow-soft"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/40 bg-panel/80 p-6 shadow-elevated">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">履歴</h3>
            <button
              onClick={fetchHistory}
              className="text-xs text-accent underline-offset-4 hover:underline"
            >
              更新
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            過去のフィードバックを選択すると詳細が確認できます。
          </p>
          <div className="mt-4 space-y-3">
            {history.length === 0 && (
              <p className="text-sm text-ink-muted">まだ記録がありません。</p>
            )}
            {history.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border border-white/30 bg-white/70 px-4 py-3 text-sm shadow-soft transition ${
                  selectedHistory?.id === item.id ? "ring-2 ring-accent" : "hover:border-accent"
                }`}
              >
                <button
                  onClick={() => handleSelectHistory(item)}
                  className="text-left w-full space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{new Date(item.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })}</span>
                    <span>
                      {item.status === "COMPLETED" ? "完了" : "継続中"}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm text-ink">{item.feedbackText}</p>
                </button>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <InsightsCard
          analysis={analysisResult}
          initialInsights={initialInsights}
        />
      </aside>
    </div>
  );
}

type InsightProps = {
  title: string;
  items: string[];
};

function InsightList({ title, items }: InsightProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/30 bg-white/70 p-4 shadow-soft">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-ink">
        {items.map((item, index) => (
          <li key={index} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

type InsightsCardProps = {
  analysis: Record<string, unknown> | null;
  initialInsights: Record<string, unknown> | null;
};

function InsightsCard({ analysis, initialInsights }: InsightsCardProps) {
  if (!analysis && !initialInsights) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/40 bg-panel/80 p-6 shadow-elevated space-y-4">
      <h3 className="text-lg font-semibold text-ink">コンテキストメモ</h3>
      {initialInsights?.initial_analysis_summary && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            初期要約
          </h4>
          <p className="text-sm text-ink leading-relaxed">
            {initialInsights.initial_analysis_summary as string}
          </p>
        </section>
      )}
      {analysis?.hypothesis && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            現在の仮説
          </h4>
          <p className="text-sm text-ink leading-relaxed">{analysis.hypothesis as string}</p>
        </section>
      )}
    </div>
  );
}
