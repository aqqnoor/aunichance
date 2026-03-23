import { useState } from "react";
import { apiPost } from "../lib/api";

type SmartProfile = {
  degree_target: string;
  intended_major: string;
  country_preferences: string[];
  language_preferences: string[];
  budget_annual?: number;
  scholarship_need: boolean;
  gpa?: number;
  gpa_scale?: number;
  ielts?: number;
  output_language: string;
};

type Recommendation = {
  program: {
    id: string;
    title: string;
    degree_level: string;
    field: string;
    university_name: string;
    country_code: string;
    tuition_amount?: number;
    tuition_currency?: string;
  };
  match_score: number;
  chance_band: string;
  chance_percent: number;
  reasoning: string[];
  improvements: string[];
  ai_explanation?: string;
};

export default function SmartSearch() {
  const [profile, setProfile] = useState<SmartProfile>({
    degree_target: "master",
    intended_major: "Computer Science",
    country_preferences: ["DE", "NL"],
    language_preferences: ["English"],
    scholarship_need: true,
    output_language: "ru",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const runMatching = async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      await apiPost("/smart-matching/profile", { profile });
      const res = await apiPost<{ recommendations: Recommendation[] }>("/smart-matching/recommendations", {
        take: 10,
        include_ai: true,
      });
      setRecs(res.recommendations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const askFollowUp = async () => {
    if (!question.trim()) return;
    try {
      const res = await apiPost<{ answer: string }>("/smart-matching/chat", {
        question,
        profile,
        recommendations: recs,
        language: profile.output_language,
      });
      setAnswer(res.answer || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Smart Matching</h1>
        <p className="text-gray-600 mt-2">Профиль → ранжированные рекомендации из базы UniChance → AI-объяснение и follow-up чат.</p>
      </div>

      <div className="card grid md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Целевая степень</span>
          <select className="input-field" value={profile.degree_target} onChange={(e) => setProfile({ ...profile, degree_target: e.target.value })}>
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Major</span>
          <input className="input-field" value={profile.intended_major} onChange={(e) => setProfile({ ...profile, intended_major: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Страны (через запятую)</span>
          <input className="input-field" value={profile.country_preferences.join(",")} onChange={(e) => setProfile({ ...profile, country_preferences: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Языки (через запятую)</span>
          <input className="input-field" value={profile.language_preferences.join(",")} onChange={(e) => setProfile({ ...profile, language_preferences: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">GPA</span>
          <input type="number" step="0.1" className="input-field" value={profile.gpa || ""} onChange={(e) => setProfile({ ...profile, gpa: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">IELTS</span>
          <input type="number" step="0.5" className="input-field" value={profile.ielts || ""} onChange={(e) => setProfile({ ...profile, ielts: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Годовой бюджет</span>
          <input type="number" className="input-field" value={profile.budget_annual || ""} onChange={(e) => setProfile({ ...profile, budget_annual: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Язык ответа AI</span>
          <select className="input-field" value={profile.output_language} onChange={(e) => setProfile({ ...profile, output_language: e.target.value })}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <button className="btn-primary" onClick={runMatching} disabled={loading}>
        {loading ? "Подбор..." : "Запустить Smart Matching"}
      </button>

      {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}

      <div className="space-y-3">
        {recs.map((r) => (
          <div key={r.program.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">{r.program.title}</h3>
                <p className="text-sm text-gray-600">{r.program.university_name} • {r.program.country_code} • {r.program.degree_level}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-xl">{r.chance_percent}%</div>
                <div className="text-xs uppercase text-gray-500">{r.chance_band}</div>
              </div>
            </div>
            <ul className="mt-3 text-sm text-gray-700 list-disc pl-5">
              {r.reasoning.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}
            </ul>
            {r.ai_explanation && <p className="mt-3 text-sm text-gray-800 bg-gray-50 rounded p-3">{r.ai_explanation}</p>}
          </div>
        ))}
      </div>

      {recs.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-xl font-semibold">Follow-up AI chat</h2>
          <div className="flex gap-2">
            <input className="input-field flex-1" placeholder="Например: Сравни 1 и 2 варианты по бюджету" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button className="btn-secondary" onClick={askFollowUp}>Спросить</button>
          </div>
          {answer && <p className="text-gray-800 whitespace-pre-line">{answer}</p>}
        </div>
      )}
    </div>
  );
}
