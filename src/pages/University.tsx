import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import { ScoreResult } from "../types";

type UniversityLink = {
  id: string;
  link_type: string;
  url: string;
  title?: string | null;
  is_official: boolean;
  priority: number;
  source_code?: string | null;
  last_verified_at?: string | null;
};

type ProgramLite = {
  id: string;
  title: string;
  degree_level: string;
  field: string;
  language: string;
  tuition_amount?: number;
  tuition_currency?: string | null;
  has_scholarship: boolean;
};

type UniversityDTO = {
  id: string;
  name: string;
  country_code: string;
  city?: string | null;
  website?: string | null;
  qs_rank?: number | null;
  the_rank?: number | null;
  data_updated_at?: string | null;
  links: UniversityLink[];
  programs: ProgramLite[];
};

function niceType(t: string) {
  const map: Record<string, string> = {
    website: "Website",
    admissions: "Admissions",
    scholarships: "Scholarships",
    requirements: "Requirements",
    ranking: "Ranking",
    news: "News",
  };
  return map[t] || t;
}

export default function University() {
  const { id } = useParams();
  const [data, setData] = useState<UniversityDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programScore, setProgramScore] = useState<ScoreResult | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr("");

    apiGet<UniversityDTO>(`/universities/${id}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const loadProgramScore = async (programId: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      return; // User not authenticated
    }

    setLoadingScore(true);
    setSelectedProgramId(programId);
    try {
      const score = await apiPost<ScoreResult>("/score", {
        program_id: programId,
      });
      setProgramScore(score);
    } catch (error) {
      console.debug("Score not available", error);
      setProgramScore(null);
    } finally {
      setLoadingScore(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-8">Loading...</div>;
  }
  if (err) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {err}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/search" className="text-primary-600 hover:underline">
          ← Back to Search
        </Link>
      </div>

      <div className="card mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{data.name}</h1>
        <p className="text-gray-600 mt-2">
          {(data.city ? `${data.city}, ` : "")}
          {data.country_code}
        </p>

        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-700">
          {data.website && (
            <a className="text-primary-600 hover:underline" href={data.website} target="_blank" rel="noreferrer">
              Official site
            </a>
          )}
          {typeof data.qs_rank === "number" && data.qs_rank > 0 && (
            <span>QS: #{data.qs_rank}</span>
          )}
          {typeof data.the_rank === "number" && data.the_rank > 0 && (
            <span>THE: #{data.the_rank}</span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* LINKS */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Useful links</h2>

          {data.links.length === 0 ? (
            <p className="text-gray-600">No links yet.</p>
          ) : (
            <div className="space-y-3">
              {data.links.map((l) => (
                <div key={l.id} className="p-3 rounded border border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-gray-900">
                      {niceType(l.link_type)}
                      {l.is_official ? (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          official
                        </span>
                      ) : null}
                    </div>
                    <a
                      className="text-primary-600 hover:underline text-sm"
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  </div>

                  {l.title && <div className="text-sm text-gray-600 mt-1">{l.title}</div>}
                  {l.source_code && (
                    <div className="text-xs text-gray-500 mt-1">source: {l.source_code}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PROGRAMS */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Programs</h2>

          {data.programs.length === 0 ? (
            <p className="text-gray-600">No programs found.</p>
          ) : (
            <div className="space-y-3">
              {data.programs.map((p) => (
                <div 
                  key={p.id} 
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedProgramId === p.id 
                      ? "border-primary-500 bg-primary-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => loadProgramScore(p.id)}
                >
                  <div className="font-semibold text-gray-900">{p.title}</div>
                  <div className="text-sm text-gray-600">
                    {p.degree_level} • {p.field} • {p.language}
                    {p.has_scholarship ? " • scholarship" : ""}
                  </div>
                  {typeof p.tuition_amount === "number" && (
                    <div className="text-sm text-gray-600 mt-1">
                      Tuition: {p.tuition_amount.toLocaleString()} {p.tuition_currency || ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SCORING DETAILS */}
      {selectedProgramId && (
        <div className="card mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Шансы поступления
          </h2>
          
          {loadingScore ? (
            <div className="text-center py-8 text-gray-600">
              Загрузка анализа...
            </div>
          ) : programScore ? (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="flex items-center gap-6">
                <div className={`px-6 py-4 rounded-lg border-2 font-bold text-3xl ${
                  programScore.category === "reach" 
                    ? "bg-red-100 text-red-800 border-red-300"
                    : programScore.category === "target"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                    : "bg-green-100 text-green-800 border-green-300"
                }`}>
                  {programScore.score}%
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {programScore.category === "reach" && "Reach (Амбициозная цель)"}
                    {programScore.category === "target" && "Target (Реалистичная цель)"}
                    {programScore.category === "safety" && "Safety (Безопасный вариант)"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Общий шанс поступления
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Детальный анализ
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">
                      {programScore.breakdown.gpa}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">GPA (из 40)</div>
                  </div>
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">
                      {programScore.breakdown.language}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Язык (из 30)</div>
                  </div>
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">
                      {programScore.breakdown.tests}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Тесты (из 20)</div>
                  </div>
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">
                      {programScore.breakdown.extras}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Достижения (из 10)</div>
                  </div>
                </div>
              </div>

              {/* Reasons */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Объяснение оценки
                </h3>
                <ul className="space-y-2">
                  {programScore.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary-600 mt-1">•</span>
                      <span className="text-gray-700">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-2">
                Для просмотра анализа шансов поступления необходимо:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Заполнить профиль</li>
                <li>• Указать GPA, IELTS/TOEFL и другие данные</li>
              </ul>
              <Link 
                to="/profile" 
                className="mt-4 inline-block text-primary-600 hover:underline font-medium"
              >
                Перейти к профилю →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
