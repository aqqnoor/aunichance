import { useState } from "react";
import { apiPost } from "../lib/api";
import type { ChanceResponse } from "../types";
import ChanceResult from "../components/ChanceResult";

export default function ChanceCalculator() {
  const [userGPA, setUserGPA] = useState("");
  const [userIELTS, setUserIELTS] = useState("");
  const [requiredGPA, setRequiredGPA] = useState("");
  const [requiredIELTS, setRequiredIELTS] = useState("");
  const [result, setResult] = useState<ChanceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await apiPost<ChanceResponse>("/api/chances/calculate", {
        user_gpa: Number(userGPA),
        user_ielts: Number(userIELTS),
        required_gpa: Number(requiredGPA),
        required_ielts: Number(requiredIELTS),
      });

      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Ошибка при расчёте шанса");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Оценить шанс</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Ваш GPA"
          value={userGPA}
          onChange={(e) => setUserGPA(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Ваш IELTS"
          value={userIELTS}
          onChange={(e) => setUserIELTS(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Required GPA"
          value={requiredGPA}
          onChange={(e) => setRequiredGPA(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Required IELTS"
          value={requiredIELTS}
          onChange={(e) => setRequiredIELTS(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black text-white px-4 py-2"
        >
          {loading ? "Считаем..." : "Рассчитать"}
        </button>
      </form>

      <ChanceResult result={result} />
    </div>
  );
}