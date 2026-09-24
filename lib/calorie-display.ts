export function getCalorieEstimateDisplay(option: {
  caloriesKcal: number | null;
  calorieEstimateStatus: "PENDING" | "ESTIMATED" | "FAILED";
}) {
  if (option.calorieEstimateStatus === "PENDING") {
    return "Calculando…";
  }

  if (
    option.calorieEstimateStatus === "ESTIMATED" &&
    Number.isInteger(option.caloriesKcal) &&
    option.caloriesKcal !== null
  ) {
    return `≈ ${option.caloriesKcal} kcal`;
  }

  return "Estimación no disponible";
}
