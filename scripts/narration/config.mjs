// How the audiobook sounds. Edit the voice or the direction here, then run `npm run narrate`.
// Changing anything in this file re-records every chapter in that language on the next run,
// because it changes how the audio would sound.
//
// Voices (OpenAI): alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse.
// Try them at https://www.openai.fm before switching.

export const MODEL = process.env.NARRATION_MODEL || 'gpt-4o-mini-tts';

export const NARRATION = {
  en: {
    voice: 'ash',
    // Spoken before the chapter text. {label} = "Chapter 3" / "Introduction".
    intro: '{label}. {title}.',
    direction: `
Identity: The author of a comic memoir, reading his own dating disasters out loud. An American guy who moved to South America and keeps getting humbled.

Tone: Sarcastic, dry and deadpan. Every line carries a raised eyebrow. Treat humiliating moments as if they were great triumphs, and obvious mistakes as if they were brilliant plans. Self-deprecating, never bitter.

Delivery: Lean on ironic words with a little eye-roll in the voice. Make a tiny pause before punchlines and let them land. Get mock-serious and slightly too proud when describing a "plan". Sound genuinely warm when the story is about someone you love, then go right back to dry.

Pacing: Unhurried and conversational, like telling a story to friends at a bar. Never rushed.

Avoid: Cartoon voices, laughing at your own jokes, or sounding like a radio announcer. Keep it natural; the sarcasm should be in the timing and the emphasis, not exaggerated.

Pronunciation: Say Portuguese and Spanish words and place names (Rio, Copacabana, Medellín, "dez cerveja") the way a gringo who has lived there for a while would, close to the local pronunciation.
`.trim(),
  },
  pt: {
    voice: 'ash',
    intro: '{label}. {title}.',
    direction: `
Idioma e sotaque: Português do Brasil, com sotaque carioca natural. Nunca use sotaque de Portugal.

Identidade: O autor de um livro de memórias cômico, lendo em voz alta os próprios desastres amorosos. Um gringo americano que se mudou para a América do Sul e vive passando vergonha.

Tom: Sarcástico, seco e debochado, com cara de paisagem. Cada frase vem com uma sobrancelha levantada. Trate os momentos humilhantes como grandes vitórias e os erros óbvios como planos geniais. Autodepreciativo, nunca amargo.

Interpretação: Dê ênfase irônica às palavras certas, com um leve revirar de olhos na voz. Faça uma pausinha antes da piada e deixe ela cair. Fique falsamente sério e um pouco orgulhoso demais ao descrever um "plano". Soe carinhoso de verdade quando a história é sobre alguém querido, e depois volte ao deboche.

Ritmo: Tranquilo e de conversa, como quem conta uma história para os amigos num bar. Sem pressa.

Evite: Vozes de desenho animado, rir das próprias piadas ou soar como locutor de rádio. Mantenha natural; o sarcasmo está no tempo e na ênfase, não no exagero.

Pronúncia: Palavras e nomes em inglês (nomes de lugares, marcas, expressões americanas) devem soar em inglês, como um brasileiro que fala inglês bem pronunciaria.
`.trim(),
  },
};

// Audio format. Speech sounds fine at 48 kbps mono; raise it if you want, at the cost of bigger files.
export const SAMPLE_RATE = 24000; // what the API sends back as PCM
export const BITRATE_KBPS = 48;

// Silence inserted between parts, in seconds.
export const PAUSE = {
  afterIntro: 1.2,
  paragraph: 0.45, // only between API chunks (pauses inside a chunk come from the voice itself)
  sceneBreak: 1.6, // "* * *"
};

// The API takes up to 2000 tokens per request. Chunks are split at paragraph breaks below this size.
export const MAX_CHUNK_CHARS = 3000;
