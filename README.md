# Roulette Analyzer

Ferramenta de análise estatística do histórico de giros de roleta. **Não promete
ganhos** — roleta é jogo de azar. O programa apenas detecta padrões e marca
gatilhos de duas estratégias customizadas (STR1 e STR2) sobre os últimos giros.

## Estrutura do projeto

```
roulette-analyzer/
├── backend/      Python + FastAPI + SQLite
└── frontend/     React + TypeScript + Vite
```

## Rodar localmente

Pré-requisitos: Python 3.11+, Node.js 18+.

### 1) Backend
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 2) Frontend (em outro terminal)
```bash
cd frontend
npm install
npm run dev
```

Abrir <http://localhost:5173>.

### Atalho

Na raiz do projeto há um `start.bat` que abre os dois servidores em janelas
separadas.

## Funcionalidades

- Mesa de apostas + racetrack (estilo Evolution Auto-Roulette)
- **STR 1 — Rugal**: detecta sequência de 3+ giros do mesmo grupo (1-9, 10-19,
  20-29, 30-36) e calcula a jogada (3 cheios + vizinhos na race).
- **STR 2 — Monitor**: detecta par de giros consecutivos com diferença = 10 e
  calcula 3 números a partir de `(soma % 36)`, `|diff|` e `36 - |diff|`.
- **Modo ao vivo**: alimenta a sessão automaticamente da API pública do
  casinoscores (Auto Roulette da Evolution).
- **Perseguição de gatilhos**: 1 gatilho ativo por estratégia até o alvo ser
  atingido.
- Sistema de contas com licença temporária e painel de administração.

## Aviso

Este é um produto de análise estatística. Não substitui responsabilidade
financeira, não garante ganhos, e o uso é exclusivo do comprador.
