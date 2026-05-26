// 🎲 Tipos de dados disponíveis para a rolagem no painel do jogador/mestre
export const DICE = [4, 6, 8, 10, 12, 20, 100];

// 📊 Lista de atributos dos personagens. 
// Usado para gerar os botões de rolagem e os campos da ficha de personagem.
export const ATTRS = [
  { key: "for", short: "FOR", label: "Força" }, 
  { key: "des", short: "DES", label: "Destreza" },
  { key: "con", short: "CON", label: "Constituição" }, 
  { key: "int", short: "INT", label: "Inteligência" },
  { key: "sab", short: "SAB", label: "Sabedoria" }, 
  { key: "car", short: "CAR", label: "Carisma" },
  { key: "sob", short: "SOB", label: "Sobrevivência" }, 
  { key: "sor", short: "SOR", label: "Sorte" },
  { key: "fe", short: "FÉ", label: "Fé" },
];

// 🎨 Paleta de cores da caneta de desenho (Mesa Virtual / Canvas)
export const PAL = ["#ef4444", "#3b82f6", "#22c55e", "#eab208", "#a855f7", "#f97316", "#ffffff", "#94a3b8","#1cd3f3", "#ec4899","#074b29","#000000" ];

// ⚡ Cores baseadas no Tipo de Habilidade (Type Colors)
// Ex: Habilidades de ataque ficam vermelhas, passivas ficam azuis...
export const TC: Record<string, string> = { 
  passiva: "#60a5fa", 
  ativa: "#f59e0b", 
  ataque: "#ef4444", 
  especial: "#a855f7" 
};

// 🛡️ Ícones baseados no Tipo de Habilidade (Type Icons)
// Adiciona os emojis corretos na lista de habilidades do personagem
export const TI: Record<string, string> = { 
  passiva: "🛡️", 
  ativa: "⚡", 
  ataque: "⚔️", 
  especial: "✨" 
};

// 🚦 Função de Cor do Bônus (Bonus Color)
// Retorna Verde se o modificador for positivo, Vermelho se for negativo e Cinza se for zero
export const bc = (v: number) => (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#475569");

// 💅 Estilo padrão para os Inputs e Selects do sistema
// Usado para manter a consistência visual em caixas de texto e dropdowns
export const I = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "#e5e7eb",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box" as const,
};