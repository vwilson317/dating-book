// "So you want to date the gringo?": a 3-question quiz where every question is a callback
// to a moment in the book. Edit freely: questions, answers, points (0-3), quips and tiers.
// `chapter` is the chapter number the question calls back to (0 = Introduction); it links there.
import type { Lang } from './ui';

export interface QuizAnswer {
  id: string;
  text: string;
  points: number;
  quip: string; // shown right after they pick it
}
export interface QuizQuestion {
  id: string;
  chapter: number;
  callback: string; // the bit of the book being referenced
  question: string;
  answers: QuizAnswer[];
}
export interface QuizTier {
  min: number; // lowest score for this tier
  emoji: string;
  title: string;
  body: string;
}

export interface Quiz {
  navLabel: string;
  title: string;
  lede: string;
  adultsOnly: string;
  start: string;
  questionOf: string; // {i} of {n}
  callbackLabel: string; // "Callback: {ch}"
  next: string;
  seeScore: string;
  restart: string;
  shareScore: string;
  shareText: string; // {score} {max} {tier}
  scoreLabel: string; // {score} / {max}
  linePromptTitle: string;
  linePrompt: string;
  lineHint: string;
  waMsg: string; // {name} {score} {max} {tier} {emoji}
  waNeedLine: string;
  questions: QuizQuestion[];
  tiers: QuizTier[]; // highest first
  promo: string; // link text shown on the home page and at the end of chapters
  promoBody: string;
}

export const quiz: Record<Lang, Quiz> = {
  en: {
    navLabel: 'Quiz',
    title: 'So you want to date the gringo?',
    lede: "Three questions, each one a callback to the book. Score high enough and you've earned the right to slide into my WhatsApp. Low score? Slide in anyway.",
    adultsOnly: '18+ and single. Obviously.',
    start: "Let's find out",
    questionOf: 'Question {i} of {n}',
    callbackLabel: 'Callback: {ch}',
    next: 'Next question →',
    seeScore: 'See my score →',
    restart: 'Take it again',
    shareScore: 'Share my score',
    shareText: 'I scored {score}/{max} on "So you want to date the gringo?": {tier}. Your turn:',
    scoreLabel: '{score} / {max}',
    linePromptTitle: 'Now the hard part',
    linePrompt:
      'In Chapter 7, a comedian opened with a tandem-bike getaway from a crime, and I answered "Front or back?" The bar is set. Write me your opening line.',
    lineHint: 'Your opening line goes after "My opening line:"',
    waMsg: 'Hey {name}! I took the quiz and scored {score}/{max}: {emoji} {tier}.\n\nMy opening line: ',
    waNeedLine: 'Add your opening line first 😉',
    questions: [
      {
        id: 'puddle',
        chapter: 0,
        callback: 'Since I was a kid, I have dreamed of the jacket-over-a-puddle move. No plan for the wet jacket.',
        question: 'It starts pouring on our first date. What do you expect from me?',
        answers: [
          { id: 'jacket', text: 'Your jacket over the puddle. Obviously.', points: 2, quip: 'Classic. But who carries the soggy jacket home? (Still no plan.)' },
          { id: 'shirt', text: 'Take your shirt off and use it as an umbrella.', points: 3, quip: 'You read Chapter 9. Ask me about that date. It\'s how you steal my heart.' },
          { id: 'umbrella', text: 'Bring an umbrella, like an adult.', points: 1, quip: 'Responsible. Suspiciously responsible.' },
        ],
      },
      {
        id: 'toxic',
        chapter: 4,
        callback: 'After a beach meetup I texted someone: "Nice to meet you. Make sure you choose the right one."',
        question: 'I send you that exact text. Your move?',
        answers: [
          { id: 'are_you_toxic', text: 'Walk over, phone in hand: "Are you toxic?"', points: 3, quip: '"Yeah, a little bit." You know how that one ended. 💋' },
          { id: 'who_said', text: 'Reply: "Who said I was choosing?"', points: 2, quip: 'Confident. I respect it, and I\'m a little scared.' },
          { id: 'read', text: 'Leave me on read.', points: 0, quip: 'Brutal. Accurate for Rio, though.' },
        ],
      },
      {
        id: 'fortune',
        chapter: 3,
        callback: 'My sushi-date fortune cookie said: "You should explore your feminine side."',
        question: 'We crack open fortune cookies and mine says exactly that. You:',
        answers: [
          { id: 'boyfriend', text: 'Ask how long I\'ve been dating my boyfriend.', points: 0, quip: 'That\'s word for word what she asked. There was no second date.' },
          { id: 'skincare', text: 'Offer to do my skincare routine.', points: 2, quip: 'Honestly? Yes, please.' },
          { id: 'steal', text: 'Laugh, then steal my cookie.', points: 3, quip: 'A little petty theft. Chapter 9 told you that was the way in.' },
        ],
      },
    ],
    tiers: [
      { min: 9, emoji: '🧩', title: 'Puzzle partner', body: 'Perfect score. I said I\'m still looking for my next puzzle partner. Prove it.' },
      { min: 7, emoji: '🚲', title: 'Tandem-bike getaway partner', body: "You'd say \"front or back?\" without missing a beat. Dangerous. I'm in." },
      { min: 4, emoji: '😏', title: 'Situationship material', body: 'Promising. A strong opening line could push you over the top.' },
      { min: 0, emoji: '🏖️', title: 'Zand erover (sand over it)', body: "We'd last about eight weeks. Luckily I live in Rio, and there's plenty of sand. Message me anyway." },
    ],
    promo: '💘 So you want to date the gringo? Take the 3-question quiz',
    promoBody: 'Every question is a callback to the book. High scores get to slide into my WhatsApp.',
  },

  pt: {
    navLabel: 'Quiz',
    title: 'Então você quer namorar o gringo?',
    lede: 'Três perguntas, cada uma com uma referência ao livro. Se a pontuação for boa, você ganha o direito de chamar no meu WhatsApp. Pontuação baixa? Chama mesmo assim.',
    adultsOnly: 'Só para maiores de 18 e solteiros. Óbvio.',
    start: 'Vamos descobrir',
    questionOf: 'Pergunta {i} de {n}',
    callbackLabel: 'Lembra? {ch}',
    next: 'Próxima pergunta →',
    seeScore: 'Ver minha pontuação →',
    restart: 'Fazer de novo',
    shareScore: 'Compartilhar pontuação',
    shareText: 'Fiz {score}/{max} no "Então você quer namorar o gringo?": {tier}. Sua vez:',
    scoreLabel: '{score} / {max}',
    linePromptTitle: 'Agora vem a parte difícil',
    linePrompt:
      'No Capítulo 7, uma comediante me convidou para um passeio de bicicleta tandem como fuga de um crime, e eu respondi: "Na frente ou atrás?" A régua está alta. Me mande sua cantada de abertura.',
    lineHint: 'Escreva sua cantada depois de "Minha cantada:"',
    waMsg: 'Oi {name}! Fiz o quiz e tirei {score}/{max}: {emoji} {tier}.\n\nMinha cantada: ',
    waNeedLine: 'Escreva sua cantada primeiro 😉',
    questions: [
      {
        id: 'puddle',
        chapter: 0,
        callback: 'Desde criança eu sonho com o gesto do casaco sobre a poça. Sem plano nenhum para o casaco molhado.',
        question: 'Começa a chover forte no nosso primeiro encontro. O que você espera de mim?',
        answers: [
          { id: 'jacket', text: 'Seu casaco sobre a poça. Óbvio.', points: 2, quip: 'Clássico. Mas quem leva o casaco encharcado para casa? (Continuo sem plano.)' },
          { id: 'shirt', text: 'Tirar a camisa e usar como guarda-chuva.', points: 3, quip: 'Você leu o Capítulo 9. Me pergunte sobre esse encontro. É assim que se rouba meu coração.' },
          { id: 'umbrella', text: 'Levar um guarda-chuva, como um adulto.', points: 1, quip: 'Responsável. Suspeitamente responsável.' },
        ],
      },
      {
        id: 'toxic',
        chapter: 4,
        callback: 'Depois de um encontro na praia, mandei para alguém: "Prazer em te conhecer. Escolhe o certo, hein."',
        question: 'Eu te mando exatamente essa mensagem. E aí?',
        answers: [
          { id: 'are_you_toxic', text: 'Vem até mim com o celular na mão: "Você é tóxico?"', points: 3, quip: '"Sim, um pouquinho." Você sabe como essa terminou. 💋' },
          { id: 'who_said', text: 'Responde: "Quem disse que eu estou escolhendo?"', points: 2, quip: 'Confiante. Eu respeito, e estou com um pouco de medo.' },
          { id: 'read', text: 'Me deixa no vácuo.', points: 0, quip: 'Brutal. Mas bem carioca.' },
        ],
      },
      {
        id: 'fortune',
        chapter: 3,
        callback: 'O biscoito da sorte do meu encontro no japonês dizia: "Você deveria explorar seu lado feminino."',
        question: 'A gente abre os biscoitos da sorte e o meu diz exatamente isso. Você:',
        answers: [
          { id: 'boyfriend', text: 'Pergunta há quanto tempo eu namoro meu namorado.', points: 0, quip: 'Foi exatamente o que ela perguntou. Não teve segundo encontro.' },
          { id: 'skincare', text: 'Se oferece para fazer meu skincare.', points: 2, quip: 'Sinceramente? Sim, por favor.' },
          { id: 'steal', text: 'Ri e rouba meu biscoito.', points: 3, quip: 'Pequenos furtos. O Capítulo 9 avisou que esse era o caminho.' },
        ],
      },
    ],
    tiers: [
      { min: 9, emoji: '🧩', title: 'A próxima peça do quebra-cabeça', body: 'Nota máxima. Eu disse que ainda estava procurando a minha próxima peça do quebra-cabeça. Prove.' },
      { min: 7, emoji: '🚲', title: 'Parceria de fuga de bicicleta tandem', body: 'Você diria "na frente ou atrás?" sem pensar duas vezes. Perigoso. Topo.' },
      { min: 4, emoji: '😏', title: 'Material de rolo', body: 'Promissor. Uma boa cantada pode fazer toda a diferença.' },
      { min: 0, emoji: '🏖️', title: 'Zand erover (areia por cima)', body: 'A gente duraria umas oito semanas. Ainda bem que moro no Rio, aqui tem areia de sobra. Me chama mesmo assim.' },
    ],
    promo: '💘 Então você quer namorar o gringo? Faça o quiz de 3 perguntas',
    promoBody: 'Cada pergunta é uma referência ao livro. Quem pontua alto ganha o direito de chamar no meu WhatsApp.',
  },
};

export const maxScore = (q: Quiz) => q.questions.reduce((sum, x) => sum + Math.max(...x.answers.map((a) => a.points)), 0);
export const tierFor = (q: Quiz, score: number) => q.tiers.find((t) => score >= t.min) ?? q.tiers[q.tiers.length - 1];
