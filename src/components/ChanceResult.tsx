import type { ChanceResponse } from "../types";

type Props = {
  result: ChanceResponse | null;
};

export default function ChanceResult({ result }: Props) {
  if (!result) return null;

  const categoryLabel =
    result.category === "safety"
      ? "Safety"
      : result.category === "target"
      ? "Target"
      : "Reach";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mt-4">
      <h3 className="text-lg font-semibold mb-2">Результат оценки</h3>

      <div className="mb-3">
        <div className="text-2xl font-bold">{result.score}%</div>
        <div className="text-sm text-gray-600">{categoryLabel}</div>
      </div>

      <div className="mb-3">
        <h4 className="font-medium mb-1">Причины</h4>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {result.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-medium mb-1">Что улучшить</h4>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {result.recommendations.map((rec, index) => (
            <li key={index}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}