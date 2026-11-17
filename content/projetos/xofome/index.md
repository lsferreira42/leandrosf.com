---
title: "Xô Fome"
date: 2026-10-01
description: "Delivery dos restaurantes da cidade, com mensalidade fixa em vez de comissão."
draft: false
tags: ["ftclabs", "go", "mysql", "redis", "delivery"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Página inicial do Xô Fome" >}}

O Xô Fome é um marketplace municipal de delivery. O restaurante recebe um link próprio de pedidos, cardápio online, checkout sem cadastro e um painel de pedidos que funciona no celular. Em vez de comissão por pedido, paga uma mensalidade fixa.

É um dos produtos da [ftclabs](https://www.ftclabs.com.br).

## Como funciona por dentro

Go, MySQL e Redis. São três binários: um serve HTTP, outro consome a fila e o terceiro faz a operação (migração, admin, chaves). Templates, arquivos estáticos e migrações vão embutidos no binário, então o deploy é uma imagem só.

Acesse em [xofome.com.br](https://www.xofome.com.br).
