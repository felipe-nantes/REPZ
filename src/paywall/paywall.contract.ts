export const PAYWALL_CONTRACT = {
  error: 'premium_required',
  paywall: {
    title: 'Treino ideal, sem perder tempo',
    subtitle: 'Treinos por IA com progressão real — feitos para o seu objetivo.',
    benefits: [
      'Treino personalizado em até 30 segundos',
      'Progressão automática de cargas e reps',
      'Substituições inteligentes se a academia estiver cheia',
      'Histórico completo para evolução real',
    ],
    preview: {
      endpoint: '/ai/workout/example',
      label: 'Ver exemplo real',
    },
    cta: {
      label: 'Ativar Premium',
      route: 'paywall',
    },
  },
};
