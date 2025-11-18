"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const cognitiveStyles = [
  { id: "multiTasking", label: "複数のことを同時に考えるのが得意" },
  { id: "singleFocus", label: "一つのことに集中するのが得意" },
  { id: "intuitive", label: "直感で動くことが多い" },
  { id: "planning", label: "計画を立ててから動くことが多い" },
  { id: "persistent", label: "一度始めたらやりきる傾向がある" },
  { id: "ruminative", label: "頭の中で思考がぐるぐるしやすい" },
  { id: "sensitive", label: "外からの刺激に敏感" },
  { id: "moodDependent", label: "気分によってパフォーマンスが変わりやすい" },
] as const;

const focusTimeOptions = [
  { id: "earlyMorning", label: "早朝" },
  { id: "lateMorning", label: "午前" },
  { id: "earlyAfternoon", label: "午後前半" },
  { id: "lateAfternoon", label: "午後後半" },
  { id: "evening", label: "夕方" },
  { id: "night", label: "夜間" },
] as const;

const expectationOptions = [
  { id: "understanding", label: "仕組みを理解したい" },
  { id: "immediateAction", label: "すぐ試せる対策を知りたい" },
  { id: "longTermPlan", label: "長期的な改善計画を立てたい" },
  { id: "selfTherapy", label: "セルフケアの方法を身につけたい" },
  { id: "community", label: "他者との関わり方を整えたい" },
  { id: "other", label: "その他" },
] as const;

const deviceUsageOptions = [
  { value: "under2h", label: "1日2時間未満" },
  { value: "2to4h", label: "1日2〜4時間" },
  { value: "4to6h", label: "1日4〜6時間" },
  { value: "6to8h", label: "1日6〜8時間" },
  { value: "over8h", label: "1日8時間以上" },
] as const;

const genders = [
  { value: "Male", label: "男性" },
  { value: "Female", label: "女性" },
  { value: "Other", label: "その他" },
  { value: "PreferNotToSay", label: "回答しない" },
] as const;

const occupations = [
  { value: "KnowledgeWorker", label: "知的労働・ホワイトカラー" },
  { value: "Creative", label: "クリエイティブ・専門職" },
  { value: "Student", label: "学生" },
  { value: "Caregiver", label: "育児・介護" },
  { value: "Healthcare", label: "医療・福祉" },
  { value: "Education", label: "教育関係" },
  { value: "Other", label: "その他" },
  { value: "PreferNotToSay", label: "回答しない" },
] as const;

const defaultForm = {
  age: "",
  gender: "",
  otherGender: "",
  occupation: "",
  otherOccupation: "",
  sleepQuality: 3,
  exerciseHabit: 3,
  cognitiveStyle: [] as string[],
  thinkingSpeed: 3,
  thinkingFlexibility: 3,
  focusTime: [] as string[],
  deviceUsage: "",
  expectations: [] as string[],
};

export default function InitialSurveyPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [formData, setFormData] = useState(defaultForm);
  const [touched, setTouched] = useState({
    sleepQuality: false,
    exerciseHabit: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const progress = useMemo(() => {
    const total = 9;
    let filled = 0;
    if (formData.age) filled += 1;
    if (formData.gender) filled += 1;
    if (formData.occupation) filled += 1;
    if (formData.deviceUsage) filled += 1;
    if (formData.cognitiveStyle.length) filled += 1;
    if (formData.focusTime.length) filled += 1;
    if (formData.expectations.length) filled += 1;
    if (touched.sleepQuality) filled += 1;
    if (touched.exerciseHabit) filled += 1;
    return Math.round((filled / total) * 100);
  }, [formData, touched]);

  useEffect(() => {
    const loadProfile = async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) return;
      const { user } = await response.json();
      if (user?.survey?.initialSurvey) {
        setFormData({ ...defaultForm, ...user.survey.initialSurvey });
        setTouched({
          sleepQuality: Boolean(user.survey.initialSurvey.sleepQuality),
          exerciseHabit: Boolean(user.survey.initialSurvey.exerciseHabit),
        });
        setCompleted(Boolean(user.surveyCompleted));
      }
    };
    loadProfile();
  }, []);

  const handleCheckboxGroup = (name: "cognitiveStyle" | "focusTime" | "expectations", value: string, checked: boolean) => {
    setFormData((prev) => {
      const current = new Set(prev[name]);

      if (checked) {
        if (name === "expectations" && current.size >= 2) {
          setError("アプリへの期待は最大2つまで選択できます。");
          return prev;
        }
        current.add(value);
      } else {
        current.delete(value);
      }

      setError(null);
      return {
        ...prev,
        [name]: Array.from(current),
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const data = await response.json();
      const message = typeof data.error === "string" ? data.error : "送信に失敗しました";
      setError(message);
      setLoading(false);
      return;
    }

    setLoading(false);
    if (update) {
      await update({
        user: {
          id: session?.user.id ?? "",
          email: session?.user.email ?? "",
          name: session?.user.name,
          surveyCompleted: true,
        },
      });
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-surface/80 px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/50 bg-panel/60 px-4 py-1 text-xs font-medium text-ink-muted shadow-soft">
            ステップ 1 / 2
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">初期プロファイルの作成</h1>
            <p className="text-ink-muted text-sm leading-relaxed">
              あなたのライフスタイルや認知リズムを理解することで、より精度の高い脳科学インサイトをお届けできます。所要時間は約3分です。
            </p>
          </div>
          <div className="h-2 w-full rounded-full bg-white/40">
            <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-3xl border border-white/50 bg-panel/80 p-6 shadow-elevated space-y-6">
            <header className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">基本情報</h2>
              <p className="text-sm text-ink-muted">個人を特定せず、認知特性の把握に必要な範囲でお伺いします。</p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="age" className="text-sm font-medium text-ink">
                  年齢
                </label>
                <input
                  id="age"
                  type="number"
                  min={15}
                  max={99}
                  value={formData.age}
                  onChange={(event) => setFormData((prev) => ({ ...prev, age: event.target.value }))}
                  className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
                  placeholder="例: 34"
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-ink">性別</span>
                <div className="grid gap-2">
                  {genders.map((item) => (
                    <label key={item.value} className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-2 shadow-soft hover:border-accent">
                      <input
                        type="radio"
                        name="gender"
                        value={item.value}
                        checked={formData.gender === item.value}
                        onChange={(event) => setFormData((prev) => ({
                          ...prev,
                          gender: event.target.value,
                          otherGender: event.target.value === "Other" ? prev.otherGender : "",
                        }))}
                      />
                      <span className="text-sm text-ink">{item.label}</span>
                    </label>
                  ))}
                  {formData.gender === "Other" && (
                    <input
                      type="text"
                      value={formData.otherGender}
                      onChange={(event) => setFormData((prev) => ({ ...prev, otherGender: event.target.value }))}
                      className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
                      placeholder="記入してください"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-ink">ご職業</span>
                <div className="grid gap-2">
                  {occupations.map((item) => (
                    <label key={item.value} className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-2 shadow-soft hover:border-accent">
                      <input
                        type="radio"
                        name="occupation"
                        value={item.value}
                        checked={formData.occupation === item.value}
                        onChange={(event) => setFormData((prev) => ({
                          ...prev,
                          occupation: event.target.value,
                          otherOccupation: event.target.value === "Other" ? prev.otherOccupation : "",
                        }))}
                      />
                      <span className="text-sm text-ink">{item.label}</span>
                    </label>
                  ))}
                  {formData.occupation === "Other" && (
                    <input
                      type="text"
                      value={formData.otherOccupation}
                      onChange={(event) => setFormData((prev) => ({ ...prev, otherOccupation: event.target.value }))}
                      className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
                      placeholder="具体的な職種"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">デバイス利用時間</label>
                <div className="grid gap-2">
                  {deviceUsageOptions.map((item) => (
                    <label key={item.value} className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-2 shadow-soft hover:border-accent">
                      <input
                        type="radio"
                        name="deviceUsage"
                        value={item.value}
                        checked={formData.deviceUsage === item.value}
                        onChange={(event) => setFormData((prev) => ({ ...prev, deviceUsage: event.target.value }))}
                      />
                      <span className="text-sm text-ink">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/50 bg-panel/80 p-6 shadow-elevated space-y-6">
            <header className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">生活リズムと認知スタイル</h2>
              <p className="text-sm text-ink-muted">集中力や思考の質に影響する日々のリズムを把握します。</p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-ink">睡眠の自己評価</label>
                <div className="rounded-2xl border border-white/40 bg-panel/60 px-4 py-4 shadow-soft">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>不規則</span>
                    <span>安定</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={formData.sleepQuality}
                    onChange={(event) => {
                      setTouched((prev) => ({ ...prev, sleepQuality: true }));
                      setFormData((prev) => ({ ...prev, sleepQuality: Number(event.target.value) }));
                    }}
                    className="w-full accent-accent"
                  />
                  <div className="text-right text-sm text-ink">
                    {formData.sleepQuality}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-ink">運動習慣の自己評価</label>
                <div className="rounded-2xl border border-white/40 bg-panel/60 px-4 py-4 shadow-soft">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>ほとんどしない</span>
                    <span>定期的</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={formData.exerciseHabit}
                    onChange={(event) => {
                      setTouched((prev) => ({ ...prev, exerciseHabit: true }));
                      setFormData((prev) => ({ ...prev, exerciseHabit: Number(event.target.value) }));
                    }}
                    className="w-full accent-accent"
                  />
                  <div className="text-right text-sm text-ink">
                    {formData.exerciseHabit}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-ink">認知スタイル（複数選択可）</label>
              <div className="grid gap-2 md:grid-cols-2">
                {cognitiveStyles.map((item) => (
                  <label key={item.id} className="inline-flex items-start gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 shadow-soft hover:border-accent">
                    <input
                      type="checkbox"
                      checked={formData.cognitiveStyle.includes(item.id)}
                      onChange={(event) => handleCheckboxGroup("cognitiveStyle", item.id, event.target.checked)}
                    />
                    <span className="text-sm text-ink leading-relaxed">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-ink">思考の速度 (1:非常に遅い 〜 5:非常に速い)</label>
                <div className="rounded-2xl border border-white/40 bg-panel/60 px-4 py-4 shadow-soft">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={formData.thinkingSpeed}
                    onChange={(event) => setFormData((prev) => ({ ...prev, thinkingSpeed: Number(event.target.value) }))}
                    className="w-full accent-accent"
                  />
                  <div className="text-right text-sm text-ink">{formData.thinkingSpeed}</div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-ink">思考の柔軟さ (1:固定的 〜 5:柔軟)</label>
                <div className="rounded-2xl border border-white/40 bg-panel/60 px-4 py-4 shadow-soft">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={formData.thinkingFlexibility}
                    onChange={(event) => setFormData((prev) => ({ ...prev, thinkingFlexibility: Number(event.target.value) }))}
                    className="w-full accent-accent"
                  />
                  <div className="text-right text-sm text-ink">{formData.thinkingFlexibility}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-ink">集中しやすい時間帯（複数選択可）</label>
              <div className="grid gap-2 md:grid-cols-3">
                {focusTimeOptions.map((item) => (
                  <label key={item.id} className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-2 shadow-soft hover:border-accent">
                    <input
                      type="checkbox"
                      checked={formData.focusTime.includes(item.id)}
                      onChange={(event) => handleCheckboxGroup("focusTime", item.id, event.target.checked)}
                    />
                    <span className="text-sm text-ink">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/50 bg-panel/80 p-6 shadow-elevated space-y-6">
            <header className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Synaplexに期待すること</h2>
              <p className="text-sm text-ink-muted">最大2つまで選択してください。</p>
            </header>
            <div className="grid gap-2 md:grid-cols-2">
              {expectationOptions.map((item) => (
                <label key={item.id} className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 shadow-soft hover:border-accent">
                  <input
                    type="checkbox"
                    checked={formData.expectations.includes(item.id)}
                    onChange={(event) => handleCheckboxGroup("expectations", item.id, event.target.checked)}
                  />
                  <span className="text-sm text-ink">{item.label}</span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-500 bg-red-50/80 border border-red-100 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-ink-muted">
              {completed ? "内容を見直し、アップデートできます。" : "送信後はダッシュボードに進みます。"}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-elevated transition hover:bg-ink/90 focus:outline-none focus:ring-4 focus:ring-ink/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "送信中..." : completed ? "更新して続行" : "回答を送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
