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

> ⚠️ **Aviso**: Esta extensão está atualmente aguardando aprovação na Chrome Web Store. Atualizaremos este aviso com o link da loja assim que for aprovada.

## Por que criei este projeto?

Durante os últimos 10 anos, como usuário frequente do Hacker News, utilizei um bookmarklet simples para checar se uma página já havia sido compartilhada. Decidi transformar isso numa extensão, com mais recursos que o bookmarklet original.

## O que você pode fazer com o HNPES

- **Pesquisar rapidamente**: Descubra em segundos se o link atual já foi submetido ao Hacker News.
- **Ver informações detalhadas**: Tenha acesso rápido à pontuação, autor, número de comentários e data da postagem.
- **Compartilhar facilmente**: Compartilhe diretamente a página atual em redes sociais e outras plataformas como Twitter, Reddit, LinkedIn e Bluesky.
- **Personalizar experiência**: Ajuste o número de resultados exibidos, modo escuro, idioma da interface e botões de compartilhamento conforme seu gosto.
- **Modo Privacidade**: Opção de desabilitar o armazenamento em cache, protegendo sua privacidade.
- **Cache avançado**: Resultados são armazenados para acesso rápido, se desejado.

## Como funciona por dentro

O HNPES é estruturado da seguinte forma:

- **Service Worker (Background Script)**: Executa consultas assíncronas na API do Hacker News e coordena a interação entre o popup e as opções.
- **Popup intuitivo**: Exibe os resultados diretamente na interface, permitindo ordenação por data, comentários ou pontuação.
- **Painel de opções avançado**: Interface intuitiva para gerenciar configurações como tema escuro, idioma, e botões de compartilhamento personalizados.

## Tecnologias escolhidas

- **JavaScript puro**: Sem dependências externas.
- **Chrome Extension API (Manifest V3)**: Versão atual da API de extensões do Chrome.
- **HTML/CSS**: Interface responsiva, com suporte a tema claro e escuro.

## Estrutura do projeto

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

## Como instalar

### Localmente no Chrome

1. Clone o repositório:

```shell
git clone https://github.com/lsferreira42/hnpes.git
```

2. Vá até `chrome://extensions` no Chrome.
3. Ative o "modo de desenvolvedor".
4. Clique em "Carregar sem compactação" e selecione o diretório da extensão.

### Usando Makefile (opcional)

Você pode compilar rapidamente com:

```shell
make build
```

## Quer saber mais?

- [Código fonte no GitHub](https://github.com/lsferreira42/hnpes)


