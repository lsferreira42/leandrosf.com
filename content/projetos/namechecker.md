---
title: "NameChecker - Project Name Availability Tool"
date: 2023-08-29
description: "Uma ferramenta web para verificar a disponibilidade de nomes de projetos em múltiplas plataformas tecnológicas, redes sociais e domínios."
draft: false
tags: ["go", "web", "tool", "developer", "namechecker"]
categories: ["projetos"]
---

## NameChecker - Project Name Availability Tool

O NameChecker verifica a disponibilidade de um nome em mais de 30 plataformas técnicas, redes sociais e extensões de domínio numa busca só. Em vez de checar GitHub, NPM, PyPI e domínios um a um, você consulta tudo de uma vez.

Acesse em [namechecker.leandrosf.com](https://namechecker.leandrosf.com).

Achar um nome livre pra um projeto é mais chato do que parece: pode estar disponível no GitHub e já registrado como domínio, ou livre no NPM e ocupado no PyPI. Cansei de checar plataforma por plataforma e automatizei isso.

## Como funciona por dentro

Backend em Go, com cada verificador exposto como endpoint separado numa API RESTful. Cache opcional em Redis reduz as requisições às plataformas. As checagens rodam de forma assíncrona conforme você digita, e o frontend organiza os resultados em três categorias: Tech, Social e Domains, com exportação em CSV.

Go pelo binário único sem runtime externo no deploy, Redis pro cache, e Docker pro empacotamento.

## Uso

Digite o nome no campo de busca e aperta Enter (ou clica em "Go"). Os resultados aparecem em tempo real, separados por categoria, com opção de baixar em CSV.

## Planos futuros

Mais plataformas e redes sociais, verificação de marca registrada, sugestão de nomes alternativos quando o desejado está ocupado, e alerta quando um nome ficar disponível.

Código e acesso: [namechecker.leandrosf.com](https://namechecker.leandrosf.com)
