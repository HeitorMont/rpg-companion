// src/types/index.ts

export interface User {
  username: string;
  pwHash: string;
  createdAt: number;
}

export interface Skill {
  id: string;
  name: string;
  type: "passiva" | "ativa" | "ataque" | "especial" | string;
  description: string;
  cost: string;
  damage: string;
  cooldown: string;
}

export interface Bonuses {
  for: number;
  des: number;
  con: number;
  int: number;
  sab: number;
  car: number;
  sob: number;
  sor: number;
  fe: number;
  [key: string]: number; // Permite acessar atributos dinamicamente
}

export interface Character {
  id: string;
  owner: string;
  name: string;
  classe: string;
  raca: string;
  nivel: number;
  hp: number;
  hpMax: number;
  vigor: number;
  vigorMax: number;
  bonuses: Bonuses;
  skills: Skill[];
  notes: string;
}

export interface Lobby {
  id: string;
  name: string;
  pwHash: string | null;
  ownerId: string;
  isPublic: boolean;
  createdAt: number;
}

export interface Member {
  username: string;
  role: "mestre" | "jogador" | "espectador" | string;
  charId: string | null;
  lobbyId: string;
  ts: number;
}

export interface ImageObj {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string;
  layer: "map" | "token" | string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Linha {
  tool: string;
  color: string;
  brush: number;
  points: Point[];
}