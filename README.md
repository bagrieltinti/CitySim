# Cidade Viva

Simulação urbana sistêmica em navegador, com dois modos:

**Jogar:** [citysim-two.vercel.app](https://citysim-two.vercel.app)

- **Sandbox observador:** acompanhe cidadãos, famílias, economia, política e evolução urbana.
- **Gameplay:** crie um cidadão e tome decisões dentro da mesma cidade simulada.

## Desenvolvimento

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Saves

O jogo oferece três slots locais por modo (seis no total). Cada cidade é comprimida e armazenada no `localStorage` do navegador, sem envio para servidor. Saves pertencem à origem onde foram criados, então domínios e previews diferentes não compartilham os mesmos dados.

## Deploy

O projeto usa Vite e publica a pasta `dist`. A produção é vinculada ao branch `main` pela integração Git do Vercel.
