import { prisma } from "@/lib/prisma";

const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type OptionCount = {
  name: string;
  count: number;
};

type DailyReportNarrativeInput = {
  dateLabel: string;
  totalSelections: number;
  topChoice: OptionCount | null;
  leastChosenOptions: OptionCount[];
  items: OptionCount[];
};

type HomeMenuNarrativeInput = {
  dateLabel: string;
  items: Array<{
    name: string;
  }>;
};

function coerceText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function getApiKey() {
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();

  if (!apiKey || apiKey === "sk-proj-xxx" || apiKey === "sk-xxx") {
    return "";
  }

  return apiKey;
}

function getModel(envName: string) {
  return process.env[envName] || DEFAULT_MODEL;
}

async function requestOpenAiNarrative({
  model,
  systemPrompt,
  brief,
  errorLabel,
}: {
  model: string;
  systemPrompt: string;
  brief: Record<string, unknown>;
  errorLabel: string;
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 220,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Brief operativo: ${JSON.stringify(brief)}` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const safeErrorText = errorText.replaceAll(
      /sk-[A-Za-z0-9_-]+/g,
      "sk-***",
    );

    throw new Error(
      `${errorLabel} (${response.status}): ${safeErrorText || "request_failed"}`,
    );
  }

  const json = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = coerceText(json?.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error("OpenAI returned empty narrative");
  }

  return { text, model };
}

function buildDailyReportBrief(input: DailyReportNarrativeInput) {
  return {
    fecha: input.dateLabel,
    total_selecciones: input.totalSelections,
    opcion_mas_pedida: input.topChoice,
    opciones_menos_pedidas: input.leastChosenOptions,
    desglose: input.items,
  };
}

function buildHomeMenuBrief(input: HomeMenuNarrativeInput) {
  return {
    fecha: input.dateLabel,
    menu: input.items,
  };
}

export function isLunchAiEnabled() {
  return Boolean(getApiKey());
}

export async function generateDailyReportNarrative(input: DailyReportNarrativeInput) {
  const model = getModel("OPENAI_DAILY_REPORT_MODEL");

  return requestOpenAiNarrative({
    model,
    errorLabel: "OpenAI daily report error",
    systemPrompt: [
      "Eres un analista operativo que resume la demanda diaria de almuerzos para un equipo interno.",
      "Usa solo el brief entregado y no inventes datos.",
      "Redacta un unico parrafo breve en espanol, de 2 a 4 oraciones, con tono ejecutivo y claro.",
      "Menciona la distribucion general, la opcion dominante si existe y cualquier senal operativa util.",
      "No uses listas, no cites JSON, no exageres, no des recomendaciones ajenas a la operacion.",
    ].join(" "),
    brief: buildDailyReportBrief(input),
  });
}

export function buildHomeMenuNarrativeFallback(input: HomeMenuNarrativeInput) {
  if (input.items.length === 0) {
    return "Todavia no hay opciones publicadas para hoy. Cuando aparezcan, te damos una razon clara para elegir cada una.";
  }

  const reasons = input.items.map(
    (item) => `**${item.name}**: opcion simple y rica para decidir rapido.`,
  );

  return reasons.join(" ");
}

export async function generateHomeMenuNarrative(input: HomeMenuNarrativeInput) {
  const model = getModel("OPENAI_HOME_MENU_MODEL");

  return requestOpenAiNarrative({
    model,
    errorLabel: "OpenAI home menu error",
    systemPrompt: [
      "Eres un recomendador amistoso y practico de una app interna para elegir almuerzo.",
      "Tu objetivo es dar una sola razon breve para elegir cada opcion disponible.",
      "Usa exclusivamente el brief entregado, sin inventar ni agregar informacion.",
      "Escribe un unico parrafo minimalista en espanol.",
      "Incluye exactamente una razon por cada plato del brief.",
      "Cada razon debe tener maximo 10 palabras despues del nombre del plato.",
      "Usa formato: **Nombre del plato**: razon breve. **Otro plato**: razon breve.",
      "Las razones deben ser concretas, apetitosas y faciles de comparar.",
      "El tono debe ser cercano y util, sin adornos.",
      "Cada vez que menciones el nombre exacto de un plato del brief, encierralo entre doble asterisco para que salga en negrita, por ejemplo **Nombre del plato**.",
      "No elijas un ganador ni digas cual es mejor; todas las opciones deben tener una razon positiva.",
      "No menciones estados de votacion, resultados, tendencias ni comparaciones competitivas entre opciones.",
      "No incluyas cantidades, numeros, conteos, volumenes ni referencias a pedidos.",
      "No uses listas, introducciones, cierres, formato JSON ni menciones sobre inteligencia artificial o modelos.",
    ].join(" "),
    brief: buildHomeMenuBrief(input),
  });
}

export async function getOrCreateHomeMenuNarrative(
  date: Date,
  input: HomeMenuNarrativeInput,
) {
  const cacheEnabled = process.env.ENABLE_HOME_MENU_NARRATIVE_CACHE === "1";
  const narrativeStore = cacheEnabled
    ? (
    prisma as typeof prisma & {
      homeMenuNarrative?: {
        findUnique: (args: unknown) => Promise<{ text: string; model: string | null } | null>;
        create: (args: unknown) => Promise<{ text: string; model: string | null }>;
      };
    }
      ).homeMenuNarrative
    : undefined;

  if (!cacheEnabled || !narrativeStore) {
    const generatedNarrative = await generateHomeMenuNarrative(input).catch((error) => {
      console.error("Home menu AI narrative failed", error);
      return null;
    });

    return (
      generatedNarrative ?? {
        text: buildHomeMenuNarrativeFallback(input),
        model: null,
      }
    );
  }

  let existingNarrative: { text: string; model: string | null } | null = null;

  try {
    existingNarrative = await narrativeStore.findUnique({
      where: { date },
      select: {
        text: true,
        model: true,
      },
    });
  } catch (error) {
    console.error("Home menu narrative cache read failed", error);
    return {
      text: buildHomeMenuNarrativeFallback(input),
      model: null,
    };
  }

  if (existingNarrative) {
    return existingNarrative;
  }

  let narrative = {
    text: buildHomeMenuNarrativeFallback(input),
    model: null as string | null,
  };

  try {
    const generatedNarrative = await generateHomeMenuNarrative(input);

    if (generatedNarrative) {
      narrative = generatedNarrative;
    }
  } catch (error) {
    console.error("Home menu AI narrative failed", error);
  }

  try {
    const createdNarrative = await narrativeStore.create({
      data: {
        date,
        text: narrative.text,
        model: narrative.model,
      },
      select: {
        text: true,
        model: true,
      },
    });

    return createdNarrative;
  } catch (error) {
    console.error("Home menu narrative cache write failed", error);
  }

  try {
    const persistedNarrative = await narrativeStore.findUnique({
    where: { date },
    select: {
      text: true,
      model: true,
    },
  });

    if (persistedNarrative) {
      return persistedNarrative;
    }
  } catch (error) {
    console.error("Home menu narrative cache reread failed", error);
  }

  return narrative;
}

export async function resetHomeMenuNarrative(date: Date) {
  const cacheEnabled = process.env.ENABLE_HOME_MENU_NARRATIVE_CACHE === "1";
  const narrativeStore = cacheEnabled
    ? (
        prisma as typeof prisma & {
          homeMenuNarrative?: {
            deleteMany: (args: unknown) => Promise<{ count: number }>;
          };
        }
      ).homeMenuNarrative
    : undefined;

  if (!cacheEnabled || !narrativeStore) {
    return { cleared: false, reason: "cache_disabled" as const };
  }

  try {
    const result = await narrativeStore.deleteMany({
      where: { date },
    });

    return {
      cleared: result.count > 0,
      reason: "ok" as const,
    };
  } catch (error) {
    console.error("Home menu narrative reset failed", error);
    return { cleared: false, reason: "error" as const };
  }
}

export async function getStoredHomeMenuNarrative(date: Date) {
  const cacheEnabled = process.env.ENABLE_HOME_MENU_NARRATIVE_CACHE === "1";
  const narrativeStore = cacheEnabled
    ? (
        prisma as typeof prisma & {
          homeMenuNarrative?: {
            findUnique: (args: unknown) => Promise<{ text: string; model: string | null } | null>;
          };
        }
      ).homeMenuNarrative
    : undefined;

  if (!cacheEnabled || !narrativeStore) {
    return null;
  }

  try {
    return await narrativeStore.findUnique({
      where: { date },
      select: {
        text: true,
        model: true,
      },
    });
  } catch (error) {
    console.error("Home menu narrative current read failed", error);
    return null;
  }
}
