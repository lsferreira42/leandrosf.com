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

A ideia surgiu enquanto eu estudava compiladores e interpretadores. Em vez de só ler teoria, quis fazer um projeto prático, e Brainfuck é um bom modelo pra isso: sintaxe mínima, mas com desafios reais de parsing e otimização.

## Como funciona

O interpretador é escrito em Go e compilado para WebAssembly, com fallback em JavaScript para quando o WASM não está disponível. Ele mantém cache do bytecode compilado pra acelerar reexecuções. O editor tem realce de sintaxe, numeração de linhas e vem com alguns exemplos prontos (Fibonacci, Mandelbrot, Hello World), rodando em modo interativo ou automatizado, com status de execução em tempo real.

O projeto é dividido em três partes: frontend em HTML/CSS/JS, interpretador em Go compilado para WASM, e empacotamento via Docker pra rodar com um comando.

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

## Rodando

Versão hospedada em [brainfuck.leandrosf.com](https://brainfuck.leandrosf.com).

Compilação local:

```shell
make build
```

Versão WebAssembly:

```shell
make web
```

Via Docker:

```shell
docker-compose up -d
```

Depois acesse `http://localhost:9093`.

Código no GitHub: [lsferreira42/bli](https://github.com/lsferreira42/bli)
