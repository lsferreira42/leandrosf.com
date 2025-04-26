+++
date = '2025-04-25T21:10:00-03:00'
draft = false
title = 'Introdução ao modulo de terraform da magalu com o opentofu'
+++

Neste post, vamos explorar como utilizar os módulos de Terraform disponibilizados pela Magalu Cloud, já adaptados para funcionar com o OpenTofu. Se você ainda não conhece o OpenTofu ou quer entender melhor sobre a migração do Terraform para esta alternativa open source, recomendo dar uma olhada no [meu post anterior sobre o OpenTofu](/posts/opentofu).

A Magalu Cloud é a plataforma de cloud computing do Magazine Luiza, oferecendo uma infraestrutura robusta e escalável para empresas de todos os tamanhos. Com uma proposta focada no mercado brasileiro, a plataforma disponibiliza diversos serviços como computação, armazenamento, banco de dados e muito mais, tudo isso com suporte local e preços competitivos.

Para facilitar a vida dos desenvolvedores e times de infraestrutura, a Magalu Cloud disponibiliza módulos oficiais de Terraform/OpenTofu que permitem provisionar e gerenciar recursos de forma declarativa e automatizada. Estes módulos seguem as melhores práticas de Infrastructure as Code (IaC) e são mantidos pela própria equipe da Magalu Cloud.

Vamos mergulhar em como começar a utilizar estes módulos para construir sua infraestrutura na Magalu Cloud de forma eficiente e padronizada.
