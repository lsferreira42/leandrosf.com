---
title: "BLI - Brainfuck IDE"
date: 2025-03-18
description: "IDE online para linguagem Brainfuck, construída com Golang e WebAssembly."
draft: false
tags: ["go", "brainfuck", "ide", "interpreters", "wasm"]
categories: ["projetos"]
---

## BLI - Brainfuck IDE

Já imaginou programar em uma linguagem que usa apenas 8 caracteres? Criei uma IDE completa para Brainfuck que torna essa experiência surpreendentemente agradável! Com uma interface intuitiva e ferramentas poderosas, você pode escrever, executar e depurar programas nesta fascinante linguagem minimalista diretamente no seu navegador.

## Por que criei este projeto?

A ideia surgiu quando eu estava me aprofundando no mundo dos compiladores e interpretadores. Em vez de apenas ler sobre teoria, decidi colocar a mão na massa com um projeto prático. Escolhi Brainfuck porque, apesar da aparente simplicidade (ou por causa dela!), ela apresenta desafios fascinantes de implementação e otimização. É como um quebra-cabeça de programação que nos ensina muito sobre como as linguagens funcionam por baixo dos panos.

## O que você pode fazer com ela

- **Programar em alta velocidade**: Graças ao WebAssembly, a execução é surpreendentemente rápida, mesmo no navegador
- **Trabalhar offline**: Há um fallback em JavaScript quando o WebAssembly não está disponível
- **Acelerar suas execuções**: Implementei um sistema de cache de bytecode que compila previamente seu código
- **Programar confortavelmente**: O editor tem realce de sintaxe, numeração de linhas e outras facilidades que você esperaria de uma IDE moderna
- **Aprender com exemplos**: Inclui programas clássicos como Fibonacci, Mandelbrot e um sofisticado Hello World para você explorar
- **Escolher seu estilo**: Execução interativa ou automatizada, dependendo da sua necessidade
- **Monitorar em tempo real**: Acompanhe o desempenho e status da execução enquanto seu código roda

## Como funciona por dentro

Dividi o projeto em partes bem definidas:

- **Frontend amigável**: Interface construída com HTML/CSS/JS que torna a experiência agradável mesmo para quem está começando
- **Motor potente em Go**: O interpretador é implementado em Golang e compilado para WebAssembly, garantindo desempenho excepcional
- **Fácil de rodar**: Tudo empacotado em Docker para você não precisar se preocupar com configurações complexas

## Tecnologias que escolhi

- **Go 1.19.13**: Linguagem perfeita para este tipo de projeto pela combinação de desempenho e legibilidade
- **Docker e Docker Compose**: Para que você possa experimentar a IDE com apenas um comando
- **WebAssembly e GopherJS**: Trazendo a velocidade de código compilado para o ambiente do navegador

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

Um simples comando e você tem tudo pronto:

```shell
make build
```

### Versão para web

Para compilar a versão WebAssembly:

```shell
make web
```

### Usando Docker (o jeito mais fácil)

Execute com apenas um comando:

```shell
docker-compose up -d
```

E visite:

```
http://localhost:9093
```

## Minha motivação pessoal

Este projeto nasceu da minha curiosidade sobre como as linguagens de programação funcionam internamente. Escolhi Brainfuck como objeto de estudo por ser um excelente modelo didático - com apenas 8 comandos, ela nos força a entender profundamente os conceitos fundamentais de interpretação e compilação. Foi uma jornada de aprendizado incrível que me ensinou muito sobre otimização de código e os bastidores da computação.

## Onde encontrar

- [Código no GitHub](https://github.com/lsferreira42/bli)


