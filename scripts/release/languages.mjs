// How chapter headings and back matter look in each language's manuscript.
// To support another language, copy a block and translate the words.

const SEP = String.raw`\s*(?:[:.\-–—]\s*(.*))?$`;

export const LANGUAGES = {
  en: {
    chapter: new RegExp(String.raw`^\s*chapter\s+([0-9]+|[\p{L}][\p{L}\- ]*?)` + SEP, 'iu'),
    prologue: new RegExp(String.raw`^\s*(prologue|preface|introduction)` + SEP, 'iu'),
    epilogue: new RegExp(String.raw`^\s*(epilogue|afterword)` + SEP, 'iu'),
    stop: /^\s*(acknowledge?ments?|about the author|also by|notes|bibliography)\s*$/iu,
    ones: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
      'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'],
    tens: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
    connectors: [],
    // common words, used to guess the language when there are no chapter headings to go on
    common: ['the', 'and', 'was', 'that', 'with', 'she', 'her', 'you', 'what', 'but'],
  },
  pt: {
    chapter: new RegExp(String.raw`^\s*cap[ií]tulo\s+([0-9]+|[\p{L}][\p{L}\- ]*?)` + SEP, 'iu'),
    prologue: new RegExp(String.raw`^\s*(pr[óo]logo|pref[áa]cio|introdu[çc][ãa]o|apresenta[çc][ãa]o)` + SEP, 'iu'),
    epilogue: new RegExp(String.raw`^\s*(ep[íi]logo|posf[áa]cio)` + SEP, 'iu'),
    stop: /^\s*(agradecimentos?|sobre o autor|do mesmo autor|notas|bibliografia|refer[êe]ncias)\s*$/iu,
    ones: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze',
      'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'],
    // alternate spellings (European Portuguese, feminine forms) -> number
    extra: { uma: 1, duas: 2, tres: 3, catorze: 14, dezasseis: 16, dezassete: 17, dezanove: 19, cinqüenta: 50 },
    tens: ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'],
    connectors: ['e'], // "vinte e um"
    common: ['que', 'não', 'uma', 'com', 'para', 'ela', 'mas', 'você', 'como', 'eu'],
  },
};

export function parseNumber(s, rules) {
  s = s.trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(/[\s-]+/).filter((p) => !rules.connectors.includes(p));
  if (!parts.length) return null;
  let n = 0;
  for (const p of parts) {
    if (rules.ones.includes(p)) n += rules.ones.indexOf(p);
    else if (rules.tens.includes(p) && p) n += rules.tens.indexOf(p) * 10;
    else if (rules.extra?.[p] != null) n += rules.extra[p];
    else return null;
  }
  return n;
}

/** Guess a manuscript's language from its text lines. */
export function detectLanguage(lines) {
  const scores = {};
  for (const [code, rules] of Object.entries(LANGUAGES)) {
    let headings = 0;
    for (const l of lines) {
      const m = l.match(rules.chapter);
      if (m && parseNumber(m[1], rules) != null) headings++;
    }
    const words = lines.join(' ').toLowerCase().split(/[^\p{L}]+/u);
    const common = words.filter((w) => rules.common.includes(w)).length / Math.max(1, words.length);
    scores[code] = headings * 10 + common * 100;
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}
