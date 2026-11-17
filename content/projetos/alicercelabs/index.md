---
title: "AlicerceLabs"
date: 2024-03-11
description: "APIs pra quem desenvolve no Brasil: CEP, CNPJ, IP, DNS, câmbio e mais."
draft: false
tags: ["ftclabs", "go", "api", "redis", "mariadb"]
categories: ["projetos"]
---

{{< figure src="capa.webp" alt="Página inicial do AlicerceLabs" >}}

O AlicerceLabs é um conjunto de APIs de infraestrutura pra quem desenvolve no Brasil: IP, CEP, CNPJ, DNS, e-mail, câmbio, filas e outras. Todas ficam atrás da mesma autenticação e respondem no mesmo formato, então integrar a segunda API dá bem menos trabalho que a primeira.

Está em desenvolvimento e, por enquanto, é grátis. É um dos produtos da [ftclabs](https://www.ftclabs.com.br).

## Como funciona por dentro

A API pública é um servidor Go. Cada API é um módulo com as suas rotas, e o que é comum mora num pacote compartilhado: o envelope de resposta, a autenticação por JWT e chave de API, o cache em Redis e o rate limit com cota por hora e por dia. Os dados de conta ficam em MariaDB.

Algumas APIs têm motor próprio em vez de repassar a consulta pra terceiros. A de IP roda sobre uma base local, e a de CEP responde do banco e ainda calcula distância e rota entre dois CEPs.

Tem SDK em Go, JavaScript e Python.

Acesse em [alicercelabs.com.br](https://www.alicercelabs.com.br).
