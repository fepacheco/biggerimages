export interface Preset {
  id: string;
  label: string;
  description: string;
  briefing: string;
  opening_hint: string;
}

export const PRESETS: Record<string, Preset> = {
  restaurante: {
    id: "restaurante",
    label: "Restaurante / Bar",
    description:
      "Restaurante, bar, cafeteria, bar de vinho — operação F&B com salão, cozinha e atendimento.",
    briefing: `O entrevistado é dono ou gestor de um restaurante / bar / bar de vinho.
Áreas típicas para investigar (não precisa cobrir todas, escolha pelo que o cliente disser):
- Reservas e fila de espera
- Cardápio, mudanças e digitalização (QR menu, app de pedido)
- Atendimento no salão (anotação, lançamento no PDV, divisão de conta)
- Cozinha (KDS, fichas técnicas, mise en place, controle de tempo)
- Estoque e CMV (entrada de notas, contagem, perdas)
- Fornecedores (cotação, pedidos recorrentes, recebimento)
- Delivery e iFood/Rappi (gestão de pedidos, tempo, avaliações)
- Marketing (Instagram, lista de transmissão, programa de fidelidade, e-mail)
- Financeiro (conciliação de maquininhas, fluxo de caixa, fechamento de mês)
- Equipe (escala, ponto, treinamento, comunicação interna)
- Experiência do cliente (NPS, reviews no Google, recorrência)
- Eventos (privatização, jantares harmonizados, wine club)`,
    opening_hint:
      "Comece pedindo um panorama curto: nome, conceito, tamanho (mesas/cobertura/equipe), há quanto tempo opera.",
  },
  outro: {
    id: "outro",
    label: "Outro tipo de negócio",
    description: "Qualquer outro segmento — a IA se adapta ao que o cliente contar.",
    briefing: `Não há preset específico. Comece descobrindo o tipo de negócio antes de mergulhar em processos.`,
    opening_hint:
      "Comece perguntando qual o tipo de negócio, o que vendem, para quem vendem e quantas pessoas trabalham lá.",
  },
};

export function getPreset(id: string): Preset {
  return PRESETS[id] ?? PRESETS.outro;
}
