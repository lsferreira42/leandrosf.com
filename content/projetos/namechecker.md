---
title: "NameChecker - Project Name Availability Tool"
date: 2023-08-29
description: "Uma ferramenta web para verificar a disponibilidade de nomes de projetos em múltiplas plataformas tecnológicas, redes sociais e domínios."
draft: false
tags: ["go", "web", "tool", "developer", "namechecker"]
categories: ["projetos"]
---

## NameChecker - Project Name Availability Tool

O NameChecker é uma ferramenta web que verifica a disponibilidade de um nome em mais de 30 plataformas tecnológicas, redes sociais e extensões de domínio, numa única busca. Em vez de checar GitHub, NPM, PyPI e domínios um a um, você consulta tudo de uma vez.

> 🔗 **Acesse agora:** [https://namechecker.leandrosf.com](https://namechecker.leandrosf.com)

## Por que criei este projeto?

Encontrar um nome livre para um projeto é mais difícil do que parece. Um nome pode estar disponível no GitHub mas já registrado como domínio, ou livre no NPM mas existente no PyPI. Cansei de verificar cada plataforma manualmente e automatizei o processo numa ferramenta única.

## O que você pode fazer com o NameChecker

- **Verificar simultaneamente**: Analise a disponibilidade em mais de 30 plataformas com um único clique
- **Verificar plataformas tecnológicas**: GitHub, NPM, PyPI, Maven, Rust Crate, Go, Ruby Gem, e muitas outras
- **Verificar redes sociais**: Bluesky, Twitter/X, Facebook, LinkedIn, Instagram, Reddit, TikTok, e mais
- **Verificar domínios**: Confira a disponibilidade em múltiplas extensões (.com, .net, .org, .io, .dev, etc.)
- **Baixar resultados**: Exporte os resultados como CSV para análise posterior
- **Usar API**: Acesse cada verificador individualmente através de endpoints da API

## Como funciona por dentro

O NameChecker é estruturado da seguinte forma:

- **Backend em Go**: Servidor web em Go (Golang)
- **API RESTful**: Cada verificador é exposto como um endpoint separado
- **Cache com Redis**: Cache opcional para reduzir requisições às plataformas
- **Interface web**: Frontend responsivo em HTML, CSS e JavaScript
- **Verificações em tempo real**: As verificações são realizadas assincronamente à medida que o usuário digita

## Tecnologias escolhidas

- **Go (Golang)**: Binário único, sem runtime externo no deploy
- **Redis**: Para caching avançado (opcional)
- **HTML/CSS/JavaScript**: Para interface do usuário limpa e responsiva
- **Docker**: Para deployment simplificado e escalabilidade

## Como usar

1. Acesse [https://namechecker.leandrosf.com](https://namechecker.leandrosf.com)
2. Digite o nome que deseja verificar no campo de busca
3. Clique no botão "Go" ou pressione Enter
4. Aguarde enquanto as verificações são realizadas em tempo real
5. Analise os resultados exibidos nas três categorias: Tech, Social e Domains
6. Opcionalmente, faça o download dos resultados em formato CSV

## Planos futuros

Estou constantemente melhorando o NameChecker e planejando novas funcionalidades, como:

- Adicionar mais plataformas e redes sociais
- Implementar verificação de marcas registradas
- Oferecer sugestões de nomes alternativos quando o desejado não estiver disponível
- Criar um sistema de alertas para notificar quando um nome desejado se tornar disponível

## Quer saber mais?

- [Acesse o NameChecker](https://namechecker.leandrosf.com)
