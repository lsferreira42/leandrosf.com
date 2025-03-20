---
title: "NameChecker - Project Name Availability Tool"
date: 2023-08-29
description: "Uma ferramenta web para verificar a disponibilidade de nomes de projetos em múltiplas plataformas tecnológicas, redes sociais e domínios."
draft: false
tags: ["go", "web", "tool", "developer", "namechecker"]
categories: ["projetos"]
---

## NameChecker - Project Name Availability Tool

Precisa encontrar um nome para seu novo projeto? O NameChecker é uma ferramenta web que permite verificar instantaneamente a disponibilidade de um nome em mais de 30 plataformas tecnológicas, redes sociais e extensões de domínio. Criada para desenvolvedores e empreendedores, esta ferramenta economiza tempo ao validar rapidamente se o nome do seu projeto está disponível em todos os lugares importantes.

> 🔗 **Acesse agora:** [https://namechecker.leandrosf.com](https://namechecker.leandrosf.com)

## Por que criei este projeto?

Como desenvolvedor, sei que encontrar um nome adequado para um projeto é mais difícil do que parece. Muitas vezes, um nome pode estar disponível no GitHub mas já ter sido registrado como domínio, ou estar livre no NPM mas já existir no PyPI. Cansei de verificar manualmente cada plataforma e decidi automatizar esse processo criando uma ferramenta unificada que verifica tudo de uma vez.

## O que você pode fazer com o NameChecker

- **Verificar simultaneamente**: Analise a disponibilidade em mais de 30 plataformas com um único clique
- **Verificar plataformas tecnológicas**: GitHub, NPM, PyPI, Maven, Rust Crate, Go, Ruby Gem, e muitas outras
- **Verificar redes sociais**: Bluesky, Twitter/X, Facebook, LinkedIn, Instagram, Reddit, TikTok, e mais
- **Verificar domínios**: Confira a disponibilidade em múltiplas extensões (.com, .net, .org, .io, .dev, etc.)
- **Baixar resultados**: Exporte os resultados como CSV para análise posterior
- **Usar API**: Acesse cada verificador individualmente através de endpoints da API

## Como funciona por dentro

O NameChecker é estruturado da seguinte forma:

- **Backend em Go**: Um servidor web em Go (Golang) leve e de alta performance
- **API RESTful**: Cada verificador é exposto como um endpoint API separado
- **Cache com Redis**: Sistema de cache opcional para melhorar performance e reduzir requisições
- **Interface moderna**: Frontend responsivo e intuitivo construído com HTML, CSS e JavaScript
- **Verificações em tempo real**: As verificações são realizadas assincronamente à medida que o usuário digita

## Tecnologias escolhidas

- **Go (Golang)**: Escolhido pela sua eficiência, performance e facilidade de deployment
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
