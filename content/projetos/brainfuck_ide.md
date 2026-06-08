---
title: "BLI - Brainfuck IDE"
date: 2025-03-18
description: "IDE online para linguagem Brainfuck, construída com Golang e WebAssembly."
draft: false
tags: ["go", "brainfuck", "ide", "interpreters", "wasm"]
categories: ["projetos"]
---

## BLI - Brainfuck IDE

O BLI é uma IDE web para Brainfuck, a linguagem que usa apenas 8 comandos. Você escreve, executa e depura programas direto no navegador, com editor, realce de sintaxe e execução via WebAssembly.

## Por que criei este projeto?

A ideia surgiu enquanto eu estudava compiladores e interpretadores. Em vez de só ler teoria, quis fazer um projeto prático. Escolhi Brainfuck porque, apesar da sintaxe mínima, a implementação tem desafios reais de parsing e otimização, e ajuda a entender como interpretadores funcionam por dentro.

## O que você pode fazer com ela

- **Execução via WebAssembly**: O interpretador roda compilado, com bom desempenho no navegador
- **Fallback em JavaScript**: Funciona quando o WebAssembly não está disponível
- **Cache de bytecode**: Compila o código previamente para acelerar reexecuções
- **Editor**: Realce de sintaxe e numeração de linhas
- **Exemplos inclusos**: Programas como Fibonacci, Mandelbrot e Hello World
- **Modos de execução**: Interativa ou automatizada
- **Status de execução**: Acompanha desempenho e estado enquanto o código roda

## Como funciona por dentro

Dividi o projeto em partes bem definidas:

- **Frontend**: Interface em HTML/CSS/JS
- **Interpretador em Go**: Implementado em Golang e compilado para WebAssembly
- **Docker**: Empacotado para rodar com um comando

## Tecnologias que escolhi

- **Go 1.19.13**: Desempenho e legibilidade para o interpretador
- **Docker e Docker Compose**: Para rodar a IDE com um comando
- **WebAssembly e GopherJS**: Rodam o código compilado no navegador

## Como está organizado

```
bli/
├── bli.go
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── mise.toml
├── go.mod
├── go.sum
├── LICENSE
└── index.html
```

## Quer experimentar?

### Acesso web

Acesse o serviço web hospedado em:

[brainfuck.leandrosf.com](https://brainfuck.leandrosf.com)


### Compilação local

Compile com:

```shell
make build
```

### Versão para web

Para compilar a versão WebAssembly:

```shell
make web
```

### Usando Docker

Execute:

```shell
docker-compose up -d
```

E visite:

```
http://localhost:9093
```

## Minha motivação pessoal

Este projeto nasceu da curiosidade sobre como linguagens de programação funcionam por dentro. Com apenas 8 comandos, Brainfuck é um bom modelo didático para estudar interpretação e compilação, e o projeto me ensinou bastante sobre otimização de código.

## Onde encontrar

- [Código no GitHub](https://github.com/lsferreira42/bli)


