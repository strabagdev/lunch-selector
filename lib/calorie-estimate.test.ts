import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

const {
  estimateMenuOptionCalories,
  parseCalorieEstimateResponse,
  MIN_CALORIES_KCAL,
  MAX_CALORIES_KCAL,
} = await import("./lunch-ai");

function openAiResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

test("calorie estimation requests strict JSON and returns the validated value", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return openAiResponse('{"caloriesKcal":650}');
  };

  const result = await estimateMenuOptionCalories("Pollo con arroz", {
    apiKey: "test-key",
    model: "test-model",
    fetchImpl,
  });

  assert.deepEqual(result, { caloriesKcal: 650, model: "test-model" });
  assert.equal(
    (requestBody?.response_format as { type?: string }).type,
    "json_schema",
  );
  assert.match(JSON.stringify(requestBody), /Pollo con arroz/);
});

test("missing API key never fabricates a calorie value", async () => {
  let fetchCount = 0;

  await assert.rejects(
    estimateMenuOptionCalories("Ensalada", {
      apiKey: "",
      fetchImpl: async () => {
        fetchCount += 1;
        return openAiResponse('{"caloriesKcal":400}');
      },
    }),
    /not configured/,
  );

  assert.equal(fetchCount, 0);
});

test("invalid structured responses are rejected", () => {
  assert.throws(
    () => parseCalorieEstimateResponse("650 kcal"),
    /invalid JSON/,
  );
  assert.throws(
    () => parseCalorieEstimateResponse('{"caloriesKcal":"650"}'),
    /integer/,
  );
  assert.throws(
    () => parseCalorieEstimateResponse('{"caloriesKcal":650,"note":"approx"}'),
    /one integer/,
  );
});

test("calorie values outside the accepted range are rejected", () => {
  assert.throws(
    () => parseCalorieEstimateResponse(`{"caloriesKcal":${MIN_CALORIES_KCAL - 1}}`),
    /outside/,
  );
  assert.throws(
    () => parseCalorieEstimateResponse(`{"caloriesKcal":${MAX_CALORIES_KCAL + 1}}`),
    /outside/,
  );
});
