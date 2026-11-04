// Languages and every piece of interface text on the site.
// To add a language: add it to LANGS, add a block to `ui`, and add its heading words to
// scripts/release/languages.mjs.

export const LANGS = {
  en: { label: 'English', short: 'EN', locale: 'en-US', ogLocale: 'en_US' },
  pt: { label: 'Português', short: 'PT', locale: 'pt-BR', ogLocale: 'pt_BR' },
} as const;

export type Lang = keyof typeof LANGS;
export const DEFAULT_LANG: Lang = 'en';
export const LANG_CODES = Object.keys(LANGS) as Lang[];

export const isLang = (s: unknown): s is Lang => typeof s === 'string' && s in LANGS;

/** "/chapters/" -> "/chapters/" for English, "/pt/chapters/" for Portuguese */
export const localePath = (lang: Lang, path: string) => (lang === DEFAULT_LANG ? path : `/${lang}${path}`);

/** getStaticPaths helper for pages under src/pages/[...lang]/ */
export const langPaths = () =>
  LANG_CODES.map((lang) => ({ params: { lang: lang === DEFAULT_LANG ? undefined : lang }, props: { lang } }));

export const ui = {
  en: {
    // Book
    bookTitle: 'Read My Book',
    bookSubtitle: 'Misadventures of a Gringo Dating Abroad',
    description: 'Free chapters, PDF downloads, and new releases from "Read My Book: Misadventures of a Gringo Dating Abroad."',

    // Navigation / chrome
    navChapters: 'Chapters',
    navDownloads: 'Downloads',
    getApp: 'Get the app',
    skip: 'Skip to content',
    home: 'home',
    languageLabel: 'Language',
    rights: 'All rights reserved.',
    by: 'by',
    dismiss: 'Dismiss',

    // Banners
    inAppTitle: 'Reading from Instagram?',
    inAppBody: 'Tap ••• and choose Open in browser to save the book to your home screen and download PDFs.',
    suggestLang: 'Leia em português →', // shown on English pages to Portuguese-speaking visitors (in PT on purpose)

    // iOS install sheet
    iosTitle: 'Add to your home screen',
    iosStep1: "Tap the Share button (□↑) in Safari's toolbar.",
    iosStep2: 'Scroll down and tap Add to Home Screen.',
    iosStep3: 'Tap Add. New chapters will be one tap away.',
    gotIt: 'Got it',

    // Home
    heroEyebrow: 'A book in progress · released chapter by chapter',
    heroLede: 'Free chapters, straight from the manuscript. Read them here, take them with you as a PDF, and come back when the next one drops.',
    startWith: (n: number) => `Start with Chapter ${n}`,
    newestChapter: 'Newest chapter',
    allChapters: 'All chapters →',
    followTitle: 'New chapters drop on Instagram first',
    followBody: 'Follow along for release dates, behind-the-scenes stories, and the occasional regret.',
    follow: (h: string) => `Follow @${h}`,
    stampTop: 'Est.',
    stampMid: 'Abroad',

    // Chapters
    chapter: (n: number) => `Chapter ${n}`,
    chaptersTitle: 'Chapters',
    chaptersEyebrow: 'Table of contents',
    chaptersDescription: 'Every chapter released so far.',
    comingOn: (d: string) => `Coming ${d}`,
    minRead: (n: number) => `${n} min read`,
    endOf: (n: number) => `End of Chapter ${n}`,
    takeWithYou: 'Take it with you',
    share: 'Share this chapter',
    linkCopied: 'Link copied',
    previous: '← Previous',
    next: 'Next →',
    allForNow: "That's all for now",
    seeComing: "See what's coming →",
    notTranslated: 'Not translated yet',

    // PDFs
    downloadPdf: '↓ Download PDF',
    earlierVersions: (n: number) => `Earlier versions (${n})`,
    downloadsTitle: 'Downloads',
    downloadsEyebrow: 'PDFs',
    downloadsDescription: 'Download chapters and full editions as PDFs.',
    downloadsLede: 'Every version stays here, so you can always grab the one you want.',
    fullEditions: 'Full editions',
    byChapter: 'By chapter',
    noPdfs: 'PDFs are on the way.',

    // Release script text (written into content files)
    editionTitle: (n: number) => `Early Reader Edition (v${n})`,
    editionDescription: (a: number, b: number) => `Chapters ${a}–${b} in one PDF.`,
    editionChanged: (list: string) => ` New or revised: ${list}.`,
    revised: (add: number, rem: number) => `Revised: +${add} / −${rem} words`,

    // Offline / 404
    offlineEyebrow: 'No signal',
    offlineTitle: "You're offline",
    offlineBody: "Chapters you've already opened still work. Reconnect to load new ones.",
    goToChapters: 'Go to chapters',

    // Reading settings (Aa panel) and progress
    readingSettings: 'Reading settings',
    theme: 'Theme',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeSepia: 'Sepia',
    themeDark: 'Dark',
    textSize: 'Text size',
    smaller: 'Smaller text',
    larger: 'Larger text',
    font: 'Font',
    fontSerif: 'Serif',
    fontSans: 'Sans',
    spacing: 'Spacing',
    spacingNormal: 'Normal',
    spacingRelaxed: 'Relaxed',
    keepAwake: 'Keep screen on while reading',
    done: 'Done',
    resume: 'Continue where you left off · {pct}%', // {pct} is filled in on the reader's device
    continueChapter: 'Continue Chapter {n}',
    readBadge: '✓ Read',
    pctRead: '{pct}% read',

    // Feedback via WhatsApp. {name}, {n}, {title}, {emoji}, {label}, {quote} are filled in on the page.
    feedbackTitle: 'How did that one land?',
    feedbackBody: 'Tap a reaction. If you want, send it to me on WhatsApp, along with anything else you want to say.',
    reactions: [
      { id: 'lol', emoji: '😂', label: 'Dying' },
      { id: 'red_flag', emoji: '🚩', label: 'Red flag' },
      { id: 'been_there', emoji: '🙈', label: 'Been there' },
      { id: 'poor_guy', emoji: '🥲', label: 'Poor guy' },
      { id: 'more', emoji: '🔥', label: 'Need more' },
    ],
    reactionThanks: 'Got it, thanks! Want to tell me more?',
    waReactionMsg: 'Hey {name}! I just read Chapter {n}, "{title}": {emoji} {label}.\n\n',
    waQuoteMsg: 'Hey {name}! This line from Chapter {n}, "{title}", got me:\n\n"{quote}"\n\n',
    waGeneralMsg: "Hey {name}! I'm reading Read My Book and ",
    waSend: 'Send on WhatsApp',
    waEditHint: 'Edit the message before you send it',
    waFrom: 'opens WhatsApp',
    quoteButton: '💬 Send this line to {name}',
    footerFeedback: '💬 Send me feedback on WhatsApp',
  },

  pt: {
    bookTitle: 'Read My Book',
    bookSubtitle: 'Desventuras de um Gringo Namorando no Exterior',
    description: 'Capítulos grátis, PDFs para baixar e novos lançamentos de "Read My Book: Desventuras de um Gringo Namorando no Exterior."',

    navChapters: 'Capítulos',
    navDownloads: 'Downloads',
    getApp: 'Baixar o app',
    skip: 'Pular para o conteúdo',
    home: 'início',
    languageLabel: 'Idioma',
    rights: 'Todos os direitos reservados.',
    by: 'por',
    dismiss: 'Fechar',

    inAppTitle: 'Lendo pelo Instagram?',
    inAppBody: 'Toque em ••• e escolha Abrir no navegador para salvar o livro na tela inicial e baixar os PDFs.',
    suggestLang: 'Read in English →',

    iosTitle: 'Adicionar à tela de início',
    iosStep1: 'Toque no botão Compartilhar (□↑) na barra do Safari.',
    iosStep2: 'Role para baixo e toque em Adicionar à Tela de Início.',
    iosStep3: 'Toque em Adicionar. Os novos capítulos vão ficar a um toque.',
    gotIt: 'Entendi',

    heroEyebrow: 'Um livro em andamento · lançado capítulo por capítulo',
    heroLede: 'Capítulos grátis, direto do manuscrito. Leia aqui, leve em PDF e volte quando o próximo sair.',
    startWith: (n: number) => `Comece pelo Capítulo ${n}`,
    newestChapter: 'Capítulo mais recente',
    allChapters: 'Todos os capítulos →',
    followTitle: 'Os novos capítulos saem primeiro no Instagram',
    followBody: 'Acompanhe as datas de lançamento, os bastidores e um ou outro arrependimento.',
    follow: (h: string) => `Siga @${h}`,
    stampTop: 'Desde',
    stampMid: 'Exterior',

    chapter: (n: number) => `Capítulo ${n}`,
    chaptersTitle: 'Capítulos',
    chaptersEyebrow: 'Sumário',
    chaptersDescription: 'Todos os capítulos lançados até agora.',
    comingOn: (d: string) => `Chega em ${d}`,
    minRead: (n: number) => `${n} min de leitura`,
    endOf: (n: number) => `Fim do Capítulo ${n}`,
    takeWithYou: 'Leve com você',
    share: 'Compartilhar capítulo',
    linkCopied: 'Link copiado',
    previous: '← Anterior',
    next: 'Próximo →',
    allForNow: 'Por enquanto é só',
    seeComing: 'Veja o que vem por aí →',
    notTranslated: 'Ainda não traduzido',

    downloadPdf: '↓ Baixar PDF',
    earlierVersions: (n: number) => `Versões anteriores (${n})`,
    downloadsTitle: 'Downloads',
    downloadsEyebrow: 'PDFs',
    downloadsDescription: 'Baixe capítulos e edições completas em PDF.',
    downloadsLede: 'Todas as versões ficam aqui, então você sempre encontra a que quiser.',
    fullEditions: 'Edições completas',
    byChapter: 'Por capítulo',
    noPdfs: 'Os PDFs estão chegando.',

    editionTitle: (n: number) => `Edição Antecipada (v${n})`,
    editionDescription: (a: number, b: number) => `Capítulos ${a}–${b} em um só PDF.`,
    editionChanged: (list: string) => ` Novos ou revisados: ${list}.`,
    revised: (add: number, rem: number) => `Revisado: +${add} / −${rem} palavras`,

    offlineEyebrow: 'Sem sinal',
    offlineTitle: 'Você está offline',
    offlineBody: 'Os capítulos que você já abriu continuam funcionando. Conecte-se para carregar os novos.',
    goToChapters: 'Ir para os capítulos',

    readingSettings: 'Configurações de leitura',
    theme: 'Tema',
    themeAuto: 'Auto',
    themeLight: 'Claro',
    themeSepia: 'Sépia',
    themeDark: 'Escuro',
    textSize: 'Tamanho do texto',
    smaller: 'Diminuir texto',
    larger: 'Aumentar texto',
    font: 'Fonte',
    fontSerif: 'Serifa',
    fontSans: 'Sem serifa',
    spacing: 'Espaçamento',
    spacingNormal: 'Normal',
    spacingRelaxed: 'Amplo',
    keepAwake: 'Manter a tela ligada durante a leitura',
    done: 'Pronto',
    resume: 'Continuar de onde parou · {pct}%',
    continueChapter: 'Continuar o Capítulo {n}',
    readBadge: '✓ Lido',
    pctRead: '{pct}% lido',

    feedbackTitle: 'O que achou deste capítulo?',
    feedbackBody: 'Toque numa reação. Se quiser, me mande pelo WhatsApp, com o que mais quiser dizer.',
    reactions: [
      { id: 'lol', emoji: '😂', label: 'Morri' },
      { id: 'red_flag', emoji: '🚩', label: 'Red flag' },
      { id: 'been_there', emoji: '🙈', label: 'Já passei por isso' },
      { id: 'poor_guy', emoji: '🥲', label: 'Coitado' },
      { id: 'more', emoji: '🔥', label: 'Quero mais' },
    ],
    reactionThanks: 'Anotado, valeu! Quer me contar mais?',
    waReactionMsg: 'Oi {name}! Acabei de ler o Capítulo {n}, "{title}": {emoji} {label}.\n\n',
    waQuoteMsg: 'Oi {name}! Esse trecho do Capítulo {n}, "{title}", me pegou:\n\n"{quote}"\n\n',
    waGeneralMsg: 'Oi {name}! Estou lendo o Read My Book e ',
    waSend: 'Enviar no WhatsApp',
    waEditHint: 'Edite a mensagem antes de enviar',
    waFrom: 'abre o WhatsApp',
    quoteButton: '💬 Mandar este trecho para o {name}',
    footerFeedback: '💬 Me mande seu feedback no WhatsApp',
  },
} satisfies Record<Lang, Record<string, unknown>>;

export type UI = (typeof ui)['en'];
export const t = (lang: Lang): UI => ui[lang];
