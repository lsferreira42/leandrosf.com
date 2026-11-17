---
title: "MapeandoStore"
date: 2026-08-11
description: "Pôster de mapa personalizado, montado no editor e entregue impresso em casa."
draft: false
tags: ["ftclabs", "react", "typescript", "go", "mapas"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Página inicial da MapeandoStore" >}}

A MapeandoStore é um gerador de pôsteres cartográficos com loja de impressão. Você escolhe o lugar, ajusta a arte do mapa no navegador e baixa em PNG ou PDF, ou compra a versão impressa e recebe em casa.

É um dos produtos da [ftclabs](https://www.ftclabs.com.br).

## Como funciona por dentro

O editor é uma aplicação React com TypeScript e MapLibre GL JS, empacotada com Vite e Bun. O mapa é desenhado no navegador, então o que aparece na tela é o que vai pro arquivo.

A API é própria, em Go com MySQL. Contato, textos legais, e-mail transacional e integrações são configurados por um painel de administração em tempo real, sem novo deploy. O pagamento passa por um serviço separado, que faz a ponte com o Mercado Pago e atende as outras lojas da ftclabs também.

Acesse em [mapeandostore.com.br](https://www.mapeandostore.com.br).
