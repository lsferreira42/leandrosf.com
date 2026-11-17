---
title: "Kiki Adventures: Treze Vidas"
date: 2026-09-16
description: "Jogo de plataforma 2D em pixel art: uma gata com treze vidas viaja no tempo. Roda no navegador, no desktop e no celular."
draft: false
tags: ["jogos", "phaser", "typescript", "pixel art"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Kiki Adventures em jogo" >}}

Kiki Adventures é um jogo de plataforma 2D em pixel art. Você joga com uma gata branca gordinha, a última Guardiã de Meridian, com um canhão de ressonância preso na pata. Alguém está desfazendo a história, e ela tem treze vidas pra impedir.

Dá pra jogar em [kikiadventures.com](https://www.kikiadventures.com).

## O que tem no jogo

São nove fases em ordem, do espaço à Lua e ao fim do tempo, e cada uma tem uma mecânica própria: vácuo e descompressão, esteiras, gravidade lunar, maré, apagões. Terminar uma fase abre a seguinte e mais nada, então nunca fica a dúvida de pra onde ir.

- onze chefes, cada um fraco contra a arma de outro (e nenhuma fraqueza é obrigatória)
- dez armas, nove delas tiradas dos chefes
- oito habilidades, cada uma também chave de algum lugar por onde você já passou
- 200 fragmentos, 29 relíquias e 35 salas secretas
- Boss Rush e New Game+ depois de terminar a história
- quinze idiomas, cada um na sua escrita

Cada morte custa uma vida e devolve ao último checkpoint. Perder a décima terceira dá Game Over, devolve todas e reinicia a fase, sem perder o que você coletou.

## Como funciona por dentro

Phaser 3 com TypeScript e Vite. O mesmo código sai pra navegador, Linux, Windows e macOS (Electron), Android e iOS (Capacitor), e ainda tem um build homebrew pra Nintendo Switch.

Teclado, controle, toque e mouse funcionam igual e dá pra trocar no meio da partida: os avisos na tela se redesenham quando o dispositivo muda. A resolução vai até 1920x1080 sem mudar um pixel do jogo, porque a câmera mostra sempre os mesmos 384x216 de mundo, e tem teste garantindo isso.

A arte, o som e os filmes de história são gerados por um pipeline em Python que mora no próprio repositório. Nada é copiado ou baixado de terceiros, com exceção das fontes dos idiomas que não cabem numa fonte de 5x7 pixels.
