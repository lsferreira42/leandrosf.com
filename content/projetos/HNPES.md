---
title: "HNPES - Hacker News Previous Entry Search"
date: 2025-03-18
description: "Extensão para Chrome que busca automaticamente entradas anteriores da URL atual no Hacker News."
draft: false
tags: ["chrome", "extension", "hackernews", "javascript", "web"]
categories: ["projetos"]
---

## HNPES - Hacker News Previous Entry Search

O HNPES é uma extensão para Chrome que verifica se a URL da aba atual já foi submetida ao Hacker News. Com um clique, mostra as submissões encontradas com pontuação, autor, número de comentários e data.

Extensão aguardando aprovação na Chrome Web Store. Atualizo esta página com o link assim que sair.

Há uns 10 anos uso um bookmarklet simples pra checar se uma página já tinha sido compartilhada no HN. O HNPES é esse bookmarklet virando extensão de verdade, com mais recursos: pontuação, autor, comentários, data, compartilhamento direto pra Twitter, Reddit, LinkedIn e Bluesky, ajuste de número de resultados, modo escuro, idioma da interface, e um modo privacidade que desliga o cache dos resultados.

## Como funciona por dentro

Um service worker roda as consultas assíncronas na API do Hacker News e coordena popup e opções. O popup mostra os resultados com ordenação por data, comentários ou pontuação. O painel de opções cobre tema, idioma e botões de compartilhamento.

Tudo em JavaScript puro, sem dependências externas, sobre a Chrome Extension API (Manifest V3).

```
hnpes/
├── background.js
├── manifest.json
├── options.html
├── options.js
├── popup.html
├── popup.js
├── Makefile
├── README.md
└── README.pt-BR.md
```

## Instalando localmente

```shell
git clone https://github.com/lsferreira42/hnpes.git
```

Depois, em `chrome://extensions`: ativa o modo de desenvolvedor, clica em "Carregar sem compactação" e seleciona o diretório da extensão.

Ou compila com `make build`.

Código no GitHub: [lsferreira42/hnpes](https://github.com/lsferreira42/hnpes)
