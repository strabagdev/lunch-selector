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
  return String(process.env.OPENAI_API_KEY ?? "").trim();
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
    throw new Error(
      `${errorLabel} (${response.status}): ${errorText || "request_failed"}`,
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
    return "La cocina sigue en modo misterio: todavia no hay opciones publicadas para hoy, asi que por ahora el menu esta jugando al escondite.";
  }

  const optionNames = input.items.map((item) => item.name);
  const readableOptions =
    optionNames.length === 1
      ? optionNames[0]
      : `${optionNames.slice(0, -1).join(", ")} y ${optionNames.at(-1)}`;

  return `Hoy el menu viene con ${readableOptions}. La idea es simple: presentar las opciones con ganas, como si cada plato estuviera haciendo una entrada elegante a la mesa y esperando su momento de gloria.`;
}

export async function generateHomeMenuNarrative(input: HomeMenuNarrativeInput) {
  const model = getModel("OPENAI_HOME_MENU_MODEL");

  return requestOpenAiNarrative({
    model,
    errorLabel: "OpenAI home menu error",
    systemPrompt: [
      "Eres la voz amistosa y un poco teatral de una app interna para elegir almuerzo.",
      "Usa solo el brief entregado y no inventes datos.",
      "Escribe un unico parrafo corto en espanol, de 2 a 4 oraciones.",
      "Debe sonar cercano, ingenioso y con humor ligero, como si presentaras el menu del dia a un equipo de trabajo.",
      "Enfocate en introducir los platos y hacerlos sonar apetitosos o memorables con imagenes ligeras y simpaticas.",
      "No hables del estado de las elecciones, ni de cual va ganando, ni de impulso, tendencia o competencia entre opciones.",
      "No menciones cantidades exactas ni aproximadas de selecciones, votos o personas para hoy.",
      "No hables de volumen, numero de pedidos, conteos, totales o magnitudes.",
      "No uses listas, no cites JSON, no hables de inteligencia artificial ni de modelos.",
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

  if (!cacheEnabled || !narrativeStore) {
    return narrative;
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
    return narrative;
  }

  if (existingNarrative) {
    return existingNarrative;
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
