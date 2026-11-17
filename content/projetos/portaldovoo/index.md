---
title: "Portal do Voo"
date: 2026-09-10
description: "Rampas de voo livre do Brasil, previsão do tempo, escolas e visualizador de voos."
draft: false
tags: ["ftclabs", "go", "voo livre", "mapas", "mysql"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Página inicial do Portal do Voo" >}}

O Portal do Voo é um site sobre voo livre no Brasil. Tem as rampas com previsão e câmera ao vivo, escolas, notícias, eventos, conta de piloto, loja e um marketplace de equipamento.

É um dos produtos da [ftclabs](https://www.ftclabs.com.br).

## O visualizador de voos

O visualizador abre registros IGC, KML e GPX e mostra a trajetória em mapa 2D ou sobre o relevo real em 3D.

A projeção e a análise rodam no navegador. Sem conta, o arquivo não sai da máquina de quem voou. Com conta, o voo fica guardado no portal, a não ser que a pessoa desmarque essa opção antes de importar.

## Como funciona por dentro

Um binário Go serve o site inteiro. O que não pode se perder fica no MySQL: conteúdo, contas, voos e marketplace. O Redis fica com o que pode ser recriado, como sessões, contadores de limite e cache de previsão. Reiniciar o Redis desloga todo mundo e mais nada.

As rampas vieram de uma importação do ParaglidingEarth, completada com outras fontes abertas, e as escolas são as homologadas pela CBVL.

Acesse em [portaldovoo.com.br](https://www.portaldovoo.com.br).
