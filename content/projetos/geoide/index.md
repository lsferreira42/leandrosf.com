---
title: "Geoide"
date: 2026-08-12
description: "Camisetas com fotos reais do espaço, com a fonte e o crédito de cada imagem."
draft: false
tags: ["ftclabs", "go", "ecommerce", "mysql"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Página inicial da Geoide" >}}

A Geoide vende camisetas estampadas com fotos reais do espaço. Cada estampa mostra de onde veio a imagem e de quem é o crédito.

É um dos produtos da [ftclabs](https://www.ftclabs.com.br).

## Como funciona por dentro

A loja roda em cima de uma base própria de e-commerce em Go, feita pra servir várias lojas com o mesmo binário. Cada domínio resolve pra um tenant, e cada tenant tem o seu banco MySQL e o seu diretório de templates. Redis cuida do que pode ser recriado e as imagens ficam num MinIO.

A Geoide é a primeira loja nessa base.

Acesse em [geoide.com.br](https://www.geoide.com.br).
