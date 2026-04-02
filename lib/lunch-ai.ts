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
  totalSelections: number;
  isClosed: boolean;
  items: OptionCount[];
  topChoice: OptionCount | null;
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
    estado: input.isClosed ? "cerrado" : "abierto",
    total_selecciones: input.totalSelections,
    opcion_lider: input.topChoice,
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

  if (input.totalSelections === 0) {
    return `Hoy el menu entra a escena con ${readableOptions}. Aun no hay votos sobre la mesa, asi que este es el momento perfecto para que alguien rompa el empate antes de que el almuerzo se ponga dramatico.`;
  }

  if (!input.topChoice) {
    return `Hoy tenemos ${readableOptions} y ya van ${input.totalSelections} elecciones dando vueltas. El tablero esta conversado, pero todavia hay espacio para un giro culinario de ultimo minuto.`;
  }

  const tiedTopChoices = input.items.filter(
    (item) => item.count === input.topChoice?.count,
  );

  if (tiedTopChoices.length > 1) {
    const tiedNames =
      tiedTopChoices.length === 2
        ? `${tiedTopChoices[0]?.name} y ${tiedTopChoices[1]?.name}`
        : tiedTopChoices.map((item) => item.name).join(", ");

    return `Hoy el menu trae ${readableOptions} y la votacion anda juguetona: ${tiedNames} van cabeza a cabeza con ${input.topChoice.count} pedidos. Basicamente, el almuerzo de hoy esta en tiempo extra.`;
  }

  return `Hoy desfilan ${readableOptions} y ${input.topChoice.name} viene sacando pecho con ${input.topChoice.count} elecciones de ${input.totalSelections}. Hay competencia, claro, pero por ahora esa opcion va caminando como si ya escuchara aplausos desde la cocina.`;
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
      "Menciona las opciones de comida de forma inteligente y grafica, alude al estado actual de las elecciones y evita sonar burlon o infantil.",
      "No uses listas, no cites JSON, no hables de inteligencia artificial ni de modelos.",
    ].join(" "),
    brief: buildHomeMenuBrief(input),
  });
}
