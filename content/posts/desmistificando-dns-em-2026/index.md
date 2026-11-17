+++
title = "Desmistificando DNS em 2026"
date = "2026-11-17T08:00:00-03:00"
draft = false
description = "Como o DNS funciona de verdade, do byte no fio ao resolv.conf do pod: resolução, raiz, registros, cache, DNSSEC, DNS cifrado, implementações, serviços e o que mudou até 2026."
tags = ["dns", "redes", "linux", "kubernetes", "dnssec", "sre"]
sumarioNivel = 2
estilos = ["dns.css"]
scripts = ["dns.js"]

[cover]
image = "capa.webp"
alt = "Árvore de nomes do DNS com um mensageiro percorrendo o caminho da raiz até um nome"
relative = true
+++

Em 11 de outubro de 2026, às 14h UTC, a chave que assina a raiz do DNS foi trocada pela segunda vez na história. A ICANN declarou a operação concluída como planejado. No mundo quase ninguém percebeu. No Brasil, a fatia de usuários atrás de um resolvedor que valida DNSSEC caiu de 54,7% pra 49,8% em dois dias, a maior perda líquida entre todos os países segundo a APNIC, e um mês depois não tinha voltado.

É um bom retrato do DNS em 2026. O protocolo é de 1983, as RFCs que ainda valem são de 1987, e ele continua sendo trocado em pleno voo. Só este ano o Encrypted Client Hello virou RFC, o .de inteiro ficou três horas fora por causa de um bug de assinatura, e a numeração das RFCs passou de 10000 com três documentos de DNS no caminho.

Juntei aqui o que eu sei e o que fui conferir sobre DNS: como ele funciona, o que trafega no fio, o que roda por trás, quais serviços existem, onde ele quebra e o que mudou até agora. É longo de propósito. As seções são independentes, então dá pra ir direto no que interessa pelo sumário.

Os quadros com a bolinha verde são interativos e consultam o DNS de verdade, do seu navegador, usando os resolvedores públicos da Cloudflare e do Google por DNS sobre HTTPS. O nome que você digitar vai pra esses dois e pra mais ninguém.

## Dez coisas que se repete sobre DNS e não são bem assim {#mitos}

Cada item leva pra seção que explica.

- **"O DNS está propagando."** Nada propaga. Cada cache guarda a resposta antiga até o TTL dela vencer, e cada um vence numa hora diferente. Está em [Cache e TTL](#cache-e-ttl).
- **"A internet tem 13 servidores raiz."** São 13 nomes, operados por 12 organizações, respondendo de 2.046 lugares. Está em [A raiz](#a-raiz).
- **"DNS é UDP na porta 53."** TCP é obrigatório desde 2016, e uma parte crescente das consultas vai pelas portas 853 e 443. Está em [O protocolo no fio](#o-protocolo-no-fio).
- **"DNSSEC cifra a consulta."** DNSSEC assina a resposta. Quem estiver no caminho continua lendo tudo. Está em [DNSSEC](#dnssec).
- **"Com DoH ninguém vê o que eu acesso."** O resolvedor vê tudo, e o nome do site ainda vaza no handshake TLS se não tiver ECH. Está em [DNS cifrado](#dns-cifrado).
- **"Baixei o TTL, então a mudança é imediata."** O TTL novo só vale pra quem buscar o registro depois da mudança. Quem já tinha o antigo espera o antigo vencer.
- **"Nome que não existe não fica em cache."** Fica. O NXDOMAIN é guardado pelo tempo que o SOA da zona mandar.
- **"CNAME pode ir em qualquer nome."** Não pode onde já existe outro registro, e a raiz da zona sempre tem SOA e NS. Está em [Os registros](#os-registros).
- **"Quem manda é o /etc/resolv.conf."** No Linux ele é a terceira parada, depois do `nsswitch.conf` e do `/etc/hosts`, e num pod do Kubernetes vem com um `ndots:5` que multiplica consulta. Está em [DNS no Linux e no Kubernetes](#linux-e-kubernetes).
- **"É sempre o DNS."** Muitas vezes o DNS é só o lugar onde a falha aparece. Na queda do Facebook em 2021 o problema era BGP. Está em [Quando o DNS cai](#quando-cai).

## O que o DNS é {#o-que-e}

O DNS é um banco de dados distribuído, hierárquico e com consistência frouxa. A chave é um trio: nome, classe e tipo. O valor é um conjunto de registros com um prazo de validade.

Três ideias seguram o resto.

A primeira é a **delegação**. Ninguém tem o banco inteiro. A raiz sabe quem cuida de `.com` e de `.br`, o `.br` sabe quem cuida de `registro.br`, e cada dono de zona publica o que quiser dali pra baixo sem pedir licença pra ninguém acima.

A segunda é o **cache**. Toda resposta vem com um TTL, e quem pergunta pode guardar a resposta por esse tempo. É o que faz o sistema aguentar a internet inteira: a esmagadora maioria das perguntas nem chega em quem tem o dado.

A terceira é consequência das outras duas: **não existe um momento em que todo mundo vê a mesma coisa**. Quando um registro muda, cada cache continua com a versão que tinha até ela vencer.

A comparação com lista telefônica atrapalha mais do que ajuda. Lista telefônica não tem delegação, não tem cache e não tem prazo de validade, que são justamente as partes que dão trabalho.

### Nomes

Um nome de domínio é uma sequência de rótulos (labels) separados por ponto, lida da direita pra esquerda. O último rótulo é sempre a raiz, que tem tamanho zero e por isso some na escrita: `www.leandrosf.com` na verdade é `www.leandrosf.com.`, com o ponto no fim. Esse ponto final é o que torna o nome absoluto (FQDN), e ele importa mais do que parece quando o assunto é [search list](#linux-e-kubernetes).

{{< dns lab="nome" titulo="Anatomia de um nome" >}}

As regras que valem:

- cada rótulo tem até 63 bytes, e o nome inteiro até 255 bytes no fio, o que dá 253 caracteres visíveis
- maiúscula e minúscula não fazem diferença na comparação
- o DNS em si aceita qualquer byte num rótulo, mas nome de host só usa letras, dígitos e hífen
- rótulo começando com sublinhado, como `_dmarc` ou `_443._tcp`, é de propósito: marca um nome que guarda dado de serviço e não é um host
- acento e outros alfabetos entram convertidos pra ASCII por punycode, e viram rótulos que começam com `xn--` (digite `pão.com.br` no quadro acima)

{{< svg src="arvore.svg" caption="Um pedaço da árvore de nomes. Em azul, o caminho até `www.leandrosf.com`." >}}

### Domínio e zona não são a mesma coisa

Domínio é um galho da árvore: `leandrosf.com` e tudo embaixo dele. Zona é o pedaço que um mesmo conjunto de servidores administra. A fronteira entre duas zonas é uma delegação, chamada de corte de zona.

`www.leandrosf.com` está no domínio `leandrosf.com` e na mesma zona, porque eu não deleguei `www` pra ninguém. Já `com.br` é uma zona separada de `br`, com NS e chaves próprias, mesmo sendo operada pela mesma organização. Dá pra ver isso no quadro de delegação mais abaixo.

## Quem é quem {#quem-e-quem}

Quatro papéis técnicos, que as pessoas vivem misturando.

O **stub resolver** é a biblioteca do sistema operacional. Ele não resolve nada: empacota a pergunta, manda pro servidor configurado e espera a resposta pronta. No Linux é a glibc, ou o systemd-resolved na frente dela.

O **resolvedor recursivo** é quem faz o trabalho. Ele recebe a pergunta do stub, anda pela árvore perguntando pra quem precisar, guarda tudo em cache e devolve a resposta final. É o servidor do seu provedor, o 1.1.1.1, o 8.8.8.8, o CoreDNS do cluster ou um Unbound na sua rede.

O **servidor autoritativo** é quem tem o dado. Ele responde só pelas zonas que carrega e não pergunta nada pra ninguém. Zonas sérias têm pelo menos dois, em redes diferentes, e o arquivo de zona é copiado do primário pros secundários por transferência de zona (AXFR e IXFR), avisada por NOTIFY.

O **forwarder** é um recursivo preguiçoso: recebe a pergunta e repassa pra outro recursivo em vez de andar pela árvore. O roteador da sua casa e o dnsmasq são isso.

Um mesmo software pode fazer mais de um papel, e é uma má ideia. Servidor que é autoritativo e recursivo ao mesmo tempo mistura dado próprio com dado de cache e já rendeu um bom número de vulnerabilidades.

Do lado administrativo tem outros três nomes. O **registry** opera o TLD e a zona dele: a Verisign no `.com`, o NIC.br no `.br`. O **registrar** vende o registro pra você. O **registrante** é você. No `.br` o Registro.br faz os dois primeiros papéis. E nenhum deles precisa ser quem hospeda a sua zona: `leandrosf.com` está registrado num lugar e os servidores de nome ficam na Cloudflare.

## A resolução, passo a passo {#resolucao}

O que acontece quando você pede `www.leandrosf.com` e ninguém tem nada em cache:

{{< dns lab="resolucao" titulo="A resolução, passo a passo" >}}

Marque "cache quente" e toque de novo. É assim que a maioria das consultas termina: uma ida e uma volta, sem raiz e sem TLD.

O `dig +trace` faz o mesmo caminho na sua máquina, bancando o recursivo. Esta é a saída, só com os primeiros servidores de cada nível:

```text
$ dig +trace +nodnssec www.leandrosf.com

.                       517773  IN  NS  a.root-servers.net.
.                       517773  IN  NS  b.root-servers.net.
[... até m.root-servers.net]
;; Received 239 bytes from 1.1.1.1#53(1.1.1.1) in 5 ms

com.                    172800  IN  NS  a.gtld-servers.net.
com.                    172800  IN  NS  b.gtld-servers.net.
[... até m.gtld-servers.net]
;; Received 842 bytes from 192.5.5.241#53(f.root-servers.net) in 21 ms

leandrosf.com.          172800  IN  NS  dawn.ns.cloudflare.com.
leandrosf.com.          172800  IN  NS  jake.ns.cloudflare.com.
;; Received 362 bytes from 2001:503:39c1::30#53(i.gtld-servers.net) in 144 ms

www.leandrosf.com.      300     IN  A   172.67.200.25
www.leandrosf.com.      300     IN  A   104.21.21.202
;; Received 78 bytes from 108.162.193.122#53(jake.ns.cloudflare.com) in 10 ms
```

Quatro perguntas e 180 ms no total, com 144 deles gastos num servidor de `.com` que respondeu de longe. Um recursivo de verdade mede o tempo de resposta de cada servidor e passa a preferir os mais rápidos, então a segunda resolução fria já sai melhor.

### O que é um referral

A resposta da raiz não é uma resposta. Olha o cabeçalho quando eu pergunto direto pra ela, sem pedir recursão:

```text
$ dig +norec @a.root-servers.net www.leandrosf.com

;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 47117
;; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 13, ADDITIONAL: 27

;; AUTHORITY SECTION:
com.                    172800  IN  NS  a.gtld-servers.net.
[...]
;; ADDITIONAL SECTION:
a.gtld-servers.net.     172800  IN  A     192.5.6.30
a.gtld-servers.net.     172800  IN  AAAA  2001:503:a83e::2:30
[...]
```

`ANSWER: 0`. A flag `aa` (resposta autoritativa) não está ligada. O que veio foi a seção de autoridade dizendo quem cuida de `.com`, e a seção adicional com os endereços desses servidores. Isso é um referral: "não sei, mas pergunte pra estes".

Os endereços na seção adicional são o **glue**. Sem eles haveria um problema de ovo e galinha sempre que o servidor de nomes de uma zona mora dentro da própria zona. Se `exemplo.com.br` é servido por `ns1.exemplo.com.br`, pra achar o IP de `ns1` eu precisaria perguntar pra `ns1`. A zona de cima quebra o ciclo publicando o endereço junto com a delegação, e a RFC 9471 passou a exigir que esse glue venha sempre.

### QNAME minimisation

No protocolo original o recursivo mandava o nome inteiro pra todo mundo: a raiz ficava sabendo que alguém queria `www.leandrosf.com`, mesmo só podendo ajudar com `.com`. Com QNAME minimisation (RFC 9156) ele pergunta pra cada nível só o que aquele nível precisa pra responder: `com. NS?` pra raiz, `leandrosf.com. NS?` pro `.com`. É o comportamento padrão dos recursivos atuais e é o que a animação mostra.

### Siga uma delegação de verdade

{{< dns lab="trace" titulo="Siga a delegação de qualquer nome" >}}

Tente `www.registro.br`, `pt.wikipedia.org` e um nome que não existe. Em `.br` aparece um nível a mais, porque `com.br`, `gov.br` e os outros são zonas delegadas.

{{< ilustra src="resolvedor.webp" alt="Um mensageiro vai a três prédios, do maior ao menor, e volta com um cartão para quem perguntou" caption="O recursivo é quem anda. Você só espera." >}}

## A raiz {#a-raiz}

A zona raiz é pequena. Hoje ela delega 1.436 TLDs e não faz mais nada: cada TLD tem os seus NS com TTL de 172800 segundos (dois dias) e, se for assinado, um DS com TTL de um dia.

Quem responde por ela são 13 nomes, de `a.root-servers.net` a `m.root-servers.net`, operados por 12 organizações (a Verisign cuida de duas letras). Cada nome é um endereço IP anunciado por anycast de muitos lugares ao mesmo tempo: em novembro de 2026 eram 2.046 instâncias no mundo. Somando os dados de cada operador, o Brasil tem por volta de 106 delas em 76 localidades, o segundo país com mais instâncias, atrás dos Estados Unidos. Só a letra F tem 71 aqui.

Dá pra perguntar a um servidor raiz qual instância respondeu, usando a classe CHAOS:

```text
$ dig @k.root-servers.net ch txt hostname.bind +short
"ns1.br-ssa.k.ripe.net"
```

Daqui de São Paulo, a letra K respondeu de Salvador.

O número 13 vem de um limite antigo. A resposta com a lista dos servidores raiz e os endereços deles precisava caber em 512 bytes, o máximo de uma mensagem DNS por UDP na especificação original. Com os nomes todos sob `root-servers.net`, pra aproveitar a compressão de nomes, treze cabem com folga (a conta está nas [curiosidades](#curiosidades)). O limite de 512 bytes caiu faz tempo, e o 13 ficou.

Nenhum recursivo descobre a raiz sozinho. Ele vem de fábrica com um arquivo de endereços (root hints) e, ao subir, pergunta a um deles a lista atual. Dá também pra não depender da raiz em tempo real: a RFC 8806 descreve como manter uma cópia local da zona raiz no próprio recursivo.

O conteúdo da zona é administrado pela IANA e publicado pela Verisign, que tem o papel de Root Zone Maintainer. Ela é assinada com DNSSEC desde 2010, e é por isso que a troca de chave de outubro importa. Essa história está na seção de [DNSSEC](#dnssec).

Dois fatos recentes mostram o tamanho da folga com que a raiz opera. Em 23 de dezembro de 2025, 10 das 13 letras levaram um DDoS com pico acima de 1 Tbps por menos de dez minutos, sem efeito visível pra usuários. E entre 29 de junho e 7 de julho de 2026 o tráfego total dobrou, de 1,6 pra 3,2 milhões de consultas por segundo, por causa de uma atualização de software de resolvedor num grupo de redes. Ninguém fora da comunidade de operadores notou nenhum dos dois.

## Os registros {#os-registros}

Todo dado no DNS é um resource record com cinco campos: nome, TTL, classe, tipo e o dado em si. Registros com mesmo nome, classe e tipo formam um RRset, e é o RRset que é a unidade de cache e de assinatura. Os tipos que aparecem no dia a dia:

{{< larga >}}

| Tipo | O que guarda | Exemplo de dado |
|---|---|---|
| `A` | endereço IPv4 | `172.67.200.25` |
| `AAAA` | endereço IPv6 | `2606:4700:3035::6815:15ca` |
| `CNAME` | apelido: este nome é outro nome | `exemplo.github.io.` |
| `NS` | quem é autoritativo pela zona | `dawn.ns.cloudflare.com.` |
| `SOA` | dados de controle da zona | ver abaixo |
| `MX` | pra onde vai o e-mail, com prioridade | `10 mail.exemplo.com.` |
| `TXT` | texto livre: SPF, DKIM, verificação de posse | `"v=spf1 -all"` |
| `PTR` | o inverso: de endereço pra nome | `one.one.one.one.` |
| `SRV` | host e porta de um serviço | `10 5 5060 sip.exemplo.com.` |
| `CAA` | quais autoridades podem emitir certificado | `0 issue "letsencrypt.org"` |
| `HTTPS` e `SVCB` | parâmetros de conexão do serviço | `1 . alpn="h3,h2"` |
| `DS`, `DNSKEY`, `RRSIG`, `NSEC`, `NSEC3` | DNSSEC | ver a seção de DNSSEC |
| `TLSA` | certificado ou chave esperada num serviço TLS (DANE) | `3 1 1 <hash>` |

{{< /larga >}}

{{< dns lab="dig" titulo="dig no navegador" >}}

Consulte duas vezes seguidas e repare no TTL: ele desce, porque a resposta está vindo do cache do resolvedor. Depois tente `cloudflare.com` com tipo `HTTPS`, `leandrosf.com` com `NS`, e um nome inventado pra ver um NXDOMAIN.

### SOA

Toda zona tem exatamente um SOA, na raiz dela. O do `.com`:

```text
$ dig com. soa +multi

com.  900 IN SOA a.gtld-servers.net. nstld.verisign-grs.com. (
                1794915294 ; serial
                1800       ; refresh (30 minutes)
                900        ; retry (15 minutes)
                604800     ; expire (1 week)
                900        ; minimum (15 minutes)
                )
```

O primeiro nome é o servidor primário. O segundo é o e-mail do responsável com o `@` trocado por ponto. O serial é a versão da zona, e refresh, retry e expire controlam a cópia pros servidores secundários. O último campo é o que mais importa na prática: ele define por quanto tempo uma resposta negativa fica em cache. Volto nele em [Cache e TTL](#cache-e-ttl).

### CNAME, e por que ele não pode ir na raiz da zona

Um CNAME diz que o nome é apelido de outro, e o resolvedor recomeça a busca pelo nome de destino. A regra é que um nome com CNAME não pode ter mais nenhum registro, porque o apelido vale pra todos os tipos.

A raiz de uma zona sempre tem SOA e NS. Logo, `exemplo.com. CNAME alguma-coisa.cdn.net.` é inválido, e esse é o motivo de tanta gente tropeçar ao apontar o domínio sem `www` pra uma CDN ou um load balancer que só entrega um nome.

As saídas que existem:

- **ALIAS, ANAME ou CNAME flattening**: extensões de cada provedor de DNS. O autoritativo resolve o destino por conta própria e responde com A e AAAA. Funciona, mas não é padrão e não sai do provedor numa transferência de zona.
- **Registro HTTPS em modo alias**: o jeito padronizado (RFC 9460). Um `HTTPS 0 destino.cdn.net.` na raiz da zona redireciona só o serviço HTTP. Depende de o cliente consultar o tipo HTTPS, o que os navegadores atuais fazem e a maioria das outras coisas não.
- **Redirecionar o domínio sem `www` pro `www`**, que é o que eu faço com `leandrosf.com`.

### HTTPS e SVCB

O registro HTTPS é a adição mais útil dos últimos anos. Numa consulta o cliente descobre que o site fala HTTP/3, em que porta, com quais endereços, e pode receber a chave do Encrypted Client Hello:

```text
$ dig cloudflare.com https +short
1 . alpn="h3,h2" ipv4hint=104.16.132.229,104.16.133.229 ipv6hint=2606:4700::6810:84e5,2606:4700::6810:85e5
```

Sem ele, o navegador só descobria o HTTP/3 depois de conectar por TCP e ler um cabeçalho `Alt-Svc`. O SVCB é a versão genérica do mesmo registro, pra outros protocolos.

### Outras armadilhas

**TXT tem limite de 255 bytes por string**, não por registro. Uma chave DKIM de 2048 bits não cabe numa string só, e o jeito certo é quebrar em várias strings dentro do mesmo registro, que o leitor concatena.

**Wildcard não é coringa de shell.** `*.exemplo.com` só responde por nomes que não existem na zona. Se `api.exemplo.com` existe com um registro TXT e mais nada, uma consulta A pra ele devolve vazio, e não o endereço do wildcard. Pior: se existe `a.b.exemplo.com`, o nome `b.exemplo.com` passa a existir, vazio, e o wildcard também não vale pra ele.

**MX e NS apontam pra nome, nunca pra IP**, e esse nome não deve ser um CNAME.

**PTR é só mais um registro**, numa árvore à parte. O reverso de `1.1.1.1` é uma consulta PTR pra `1.1.1.1.in-addr.arpa`, e quem controla essa zona é o dono do bloco de endereços, não o dono do domínio. Por isso reverso de IP de VPS se configura no painel do provedor.

## O protocolo no fio {#o-protocolo-no-fio}

Pergunta e resposta têm o mesmo formato: um cabeçalho fixo de 12 bytes e quatro seções.

{{< svg src="cabecalho.svg" caption="O cabeçalho de toda mensagem DNS." >}}

- **ID**: 16 bits sorteados pelo cliente, repetidos na resposta
- **QR**: 0 é pergunta, 1 é resposta
- **OPCODE**: quase sempre 0 (QUERY). Os outros que ainda existem são NOTIFY (4) e UPDATE (5)
- **AA**: a resposta veio de um autoritativo da zona
- **TC**: a resposta foi cortada porque não coube
- **RD**: o cliente pede recursão
- **RA**: o servidor oferece recursão
- **AD**: o resolvedor validou a resposta com DNSSEC
- **CD**: o cliente pede que o resolvedor não valide
- **RCODE**: o resultado

Depois do cabeçalho vêm a pergunta (nome, tipo e classe), a resposta, a autoridade e os registros adicionais. Monte uma pergunta e veja cada byte:

{{< dns lab="pacote" titulo="A pergunta, byte a byte" >}}

Repare que não existe ponto no fio. Cada rótulo vai precedido do seu tamanho, e o nome termina num byte zero, que é a raiz. Nas respostas os nomes se repetem muito, então existe compressão: em vez de escrever `leandrosf.com` de novo, o servidor põe um ponteiro de dois bytes (os dois bits de cima ligados, `0xC0`) pra posição onde o nome já apareceu.

### Os códigos de resposta

| RCODE | Nome | O que quer dizer |
|---|---|---|
| 0 | NOERROR | deu certo. Pode vir sem nenhum registro (NODATA): o nome existe, o tipo não |
| 1 | FORMERR | o servidor não entendeu a pergunta |
| 2 | SERVFAIL | o servidor não conseguiu responder: autoritativo fora, DNSSEC inválido, timeout |
| 3 | NXDOMAIN | o nome não existe, em tipo nenhum |
| 5 | REFUSED | o servidor não atende essa pergunta pra você |

NXDOMAIN e NODATA são diferentes, e confundir os dois custa tempo de troubleshooting. NXDOMAIN diz que o nome não existe e, pela RFC 8020, que nada existe embaixo dele. NODATA diz só que aquele tipo não está lá.

SERVFAIL é o mais chato porque esconde a causa. Desde a RFC 8914 o servidor pode mandar junto um Extended DNS Error dizendo o motivo, e o `dig` mostra:

```text
$ dig @1.1.1.1 dnssec-failed.org

;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 51596
; EDE: 9 (DNSKEY Missing): (no SEP matching the DS found for dnssec-failed.org.)
```

### UDP, 512 bytes e EDNS

A especificação de 1987 limita a mensagem por UDP a 512 bytes. Passou disso, o servidor corta, liga a flag TC e o cliente repete a pergunta por TCP.

O EDNS (RFC 6891) é a gambiarra oficial que estendeu o protocolo sem mudar o cabeçalho: um pseudo-registro `OPT` na seção adicional, onde o cliente anuncia o maior datagrama que aceita e carrega opções extras. No quadro acima, ligue e desligue o EDNS pra ver esse registro aparecer no fim da mensagem.

O valor anunciado hoje é 1232 bytes, e não foi escolhido ao acaso: é o MTU mínimo do IPv6 (1280) menos os cabeçalhos de IPv6 e UDP. A ideia do DNS Flag Day de 2020 foi parar de depender de fragmentação de IP, que é frágil e já foi usada em ataque de envenenamento de cache. BIND, Unbound, Knot Resolver e PowerDNS Recursor usam 1232 por padrão.

Aqui está um corte de verdade. Pedi as chaves da raiz por UDP, com um buffer de 512 bytes e com as assinaturas:

```text
$ dig @a.root-servers.net . dnskey +dnssec +notcp +bufsize=512 +ignore

;; flags: qr aa tc rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
;; MSG SIZE  rcvd: 303
```

Veio a flag `tc` e um registro só. Sem o `+ignore`, o `dig` teria repetido a consulta por TCP sozinho.

Daí sai a consequência prática: **TCP na porta 53 não é opcional**. A RFC 7766 tornou o suporte obrigatório em 2016 e a RFC 9210 repetiu pra quem opera rede. Firewall que só libera 53/udp funciona até o dia em que uma resposta cresce, e DNSSEC faz respostas crescerem.

Pelo OPT também passam as opções que apareceram depois: cookies (RFC 7873) contra spoofing, NSID pra saber qual instância respondeu, client subnet, padding pra esconder o tamanho em conexões cifradas e os Extended DNS Errors.

### Por que a porta de origem importa

A única coisa que impede alguém de fora de forjar uma resposta por UDP é adivinhar o ID de 16 bits e a porta de origem da pergunta. Em 2008, Dan Kaminsky mostrou que só o ID era pouco: dava pra envenenar o cache de um recursivo em segundos. A correção foi sortear também a porta de origem, e é por isso que NAT ou firewall que reescreve portas de forma previsível na frente de um recursivo é um problema de segurança.

## Cache e TTL {#cache-e-ttl}

O TTL é um número de segundos que o dono da zona põe em cada RRset. Quem recebe a resposta pode guardar por até esse tempo, e vai descontando. Quando um recursivo responde do cache, o TTL que ele informa é o que sobrou.

{{< ilustra src="cache-ttl.webp" alt="Bilhetes presos numa prateleira, cada um com um cronômetro em um ponto diferente; o último, vencido, cai numa lixeira" caption="Cada cópia tem o seu próprio relógio." >}}

Não existe mecanismo de invalidação. O dono da zona não sabe quem tem a resposta em cache e não tem como avisar ninguém. É daí que nasce a tal "propagação":

{{< dns lab="ttl" titulo="O que acontece quando você troca um registro" >}}

Cada resolvedor do quadro buscou o registro num momento diferente, então cada um tem um prazo diferente pra vencer. O efeito de fora parece uma onda se espalhando, e por isso o nome pegou. Mas o que existe são milhares de caches vencendo cada um no seu tempo.

### Trocar um registro sem susto

O TTL novo só vale pra quem buscar o registro depois da troca. Então a ordem é:

1. Com antecedência de pelo menos um TTL antigo, baixe o TTL do registro (de 3600 pra 300, por exemplo).
2. Espere o TTL antigo passar. Agora todo cache tem a versão de 300 segundos.
3. Troque o dado. Em cinco minutos todo mundo vê o novo.
4. Confirmou que está certo, suba o TTL de novo.

Trocar os servidores de nome da zona é mais lento, porque o NS e o glue que valem ficam na zona de cima, com o TTL dela. No `.com` e no `.br` são 172800 segundos. Durante dois dias uma parte do mundo ainda pergunta pros servidores antigos, então eles precisam continuar respondendo, e com os mesmos dados.

### Resposta negativa também fica em cache

Um NXDOMAIN é guardado pelo menor valor entre o TTL do SOA e o campo `minimum` dele (RFC 2308). O servidor manda o SOA na seção de autoridade justamente pra isso:

```text
$ dig naoexiste.leandrosf.com

;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 28383

;; AUTHORITY SECTION:
leandrosf.com.  1800  IN  SOA  dawn.ns.cloudflare.com. dns.cloudflare.com. 2419948447 10000 2400 604800 1800
```

Na minha zona são 1800 segundos. Se alguém consultar `novo.leandrosf.com` antes de eu criar o registro, o resolvedor dele vai responder "não existe" por até meia hora depois que o registro passar a existir. É o caso clássico de testar o nome antes de criar e depois achar que o DNS está demorando.

Nos TLDs o valor varia: 900 segundos no `.com` e no `.br`, 86400 na raiz. Um TLD digitado errado fica um dia inteiro no cache como inexistente.

### O TTL nem sempre é respeitado

O TTL é um teto que o dono sugere. Na prática:

- recursivos têm mínimo e máximo configuráveis, e alguns operadores esticam TTL curto pra economizar consulta
- com serve-stale (RFC 8767) o recursivo pode entregar um registro vencido se não conseguir falar com o autoritativo, o que é ótimo num incidente e confuso num teste
- o sistema operacional tem cache próprio (systemd-resolved, o serviço de DNS do Windows, o mDNSResponder do macOS)
- navegadores guardam por conta própria, em geral por algo perto de um minuto
- aplicações de vida longa resolvem uma vez e seguram a conexão, ou o endereço, por horas. Connection pool não lê TTL

O último item explica a maior parte dos casos de "troquei o DNS e o serviço X continua indo pro IP antigo". Reiniciar o cliente resolve, e nenhuma mudança de TTL teria resolvido.

## DNSSEC {#dnssec}

O DNS original não tem como provar que uma resposta é verdadeira. Quem conseguir responder antes do servidor certo, ou estiver no caminho, entrega o que quiser. O DNSSEC resolve isso com assinatura: cada RRset da zona ganha um registro `RRSIG`, e quem valida confere a assinatura com a chave pública da zona.

Ele garante duas coisas: que o dado veio do dono da zona e que não foi alterado. Garante também a negativa, ou seja, que um nome realmente não existe. Ele **não cifra nada**. A pergunta e a resposta continuam em texto puro.

{{< ilustra src="dnssec.webp" alt="Uma âncora no topo e três pergaminhos lacrados presos em corrente; ao lado, um falsário com um pergaminho de lacre quebrado é barrado" caption="Uma cadeia de assinaturas presa numa âncora." >}}

### A cadeia de confiança

A chave pública da zona fica na própria zona, num registro `DNSKEY`. Confiar nela só porque a zona diz seria circular, então a zona de cima publica um `DS`, que é um hash da chave da zona de baixo, assinado pela zona de cima. Sobe-se assim até a raiz, cuja chave o validador traz configurada: a âncora de confiança.

{{< dns lab="dnssec" titulo="Cadeia de confiança ao vivo" >}}

Vale clicar nos quatro exemplos. `registro.br` fecha a cadeia inteira. `leandrosf.com` para no `.com`: o meu domínio não tem DS, então não é assinado, e o resolvedor responde sem validar. `dnssec-failed.org` é um domínio quebrado de propósito, com um DS que não bate com chave nenhuma, e por isso volta SERVFAIL em qualquer resolvedor que valida.

Esse é o detalhe que mais confunde: **zona sem assinatura não é erro**. O validador prova, pela ausência do DS, que a zona é insegura e segue a vida. Erro é ter DS e a assinatura não fechar.

Na linha de comando, o `delv` faz a validação localmente e mostra o veredito:

```text
$ delv registro.br
; fully validated
registro.br.  165331  IN  A      200.160.2.3
registro.br.  165331  IN  RRSIG  A 13 2 172800 20261228084215 20261019080106 59973 registro.br. rfTYPHHh...
```

No RRSIG dá pra ler o algoritmo (13), o TTL original (172800), a validade da assinatura (até 28 de dezembro) e o key tag da chave que assinou (59973, o mesmo que aparece no quadro).

### KSK, ZSK e algoritmos

A maioria das zonas usa duas chaves. A KSK assina só o conjunto de chaves e é ela que o DS da zona de cima referencia. A ZSK assina todo o resto e pode ser trocada sem falar com ninguém. Zonas menores usam uma chave só pras duas funções, como o `registro.br` acima.

Os algoritmos em uso em 2026:

- **13, ECDSA P-256**: o padrão de fato. Chaves e assinaturas pequenas. É o que `.br` e `.com` usam (a Verisign migrou `.com`, `.net` e `.edu` de RSA pra ele em 2023)
- **8, RSA/SHA-256**: ainda é o da raiz
- **15, Ed25519**: suportado, menos usado
- **5 e 7, RSA/SHA-1**: proibidos pra assinar desde a RFC 9905, de novembro de 2025
- **12, GOST**: aposentado pela RFC 9906

O registro da IANA já lista o algoritmo 18, ML-DSA-44, que é pós-quântico e ainda se apoia num draft. O problema dele é tamanho: uma assinatura tem mais de 2 KB, o que joga praticamente toda resposta assinada pra TCP.

### Provar que um nome não existe

Assinar uma resposta que existe é fácil. Pra assinar um "não existe" sem ter a chave privada online, a zona encadeia os nomes em ordem: o registro `NSEC` de um nome diz qual é o próximo nome que existe. Se você perguntou por algo que cairia entre os dois, está provado que não existe.

O efeito colateral é que dá pra andar pela cadeia e listar a zona inteira. O `NSEC3` faz o mesmo com hashes dos nomes, o que dificulta a listagem sem impedir. A recomendação atual (RFC 9276) é usar zero iterações extras e nenhum salt, e é assim que o `.com` está.

Provedores que assinam na hora da resposta foram por outro caminho, padronizado em 2025 como Compact Denial of Existence (RFC 9824): em vez de NXDOMAIN, respondem NOERROR sem dados, com um NSEC mínimo. Dá pra ver no quadro do `dig`: `qualquercoisa.example.com` devolve NOERROR, e não NXDOMAIN.

### A troca da chave da raiz

A raiz é assinada desde 2010. A primeira KSK ficou até 11 de outubro de 2018, quando entrou a KSK-2017 (key tag 20326), depois de um ano de adiamento por medo de resolvedores que não tinham aprendido a chave nova.

A segunda troca seguiu o mesmo roteiro. A KSK-2024 (key tag 38696) foi gerada em abril de 2024, publicada na zona em 11 de janeiro de 2025 e passou a assinar em 11 de outubro de 2026. As duas ainda estão lá:

```text
$ dig . dnskey +multi +dnssec

.  1250 IN DNSKEY 256 3 8 ( ... ) ; ZSK; alg = RSASHA256 ; key id = 8763
.  1250 IN DNSKEY 257 3 8 ( ... ) ; KSK; alg = RSASHA256 ; key id = 20326
.  1250 IN DNSKEY 257 3 8 ( ... ) ; KSK; alg = RSASHA256 ; key id = 38696
.  1250 IN RRSIG  DNSKEY 8 0 172800 (
                20261201000000 20261110000000 38696 .
                ... )
```

Três chaves, e o RRSIG do conjunto é da 38696. A chave antiga será marcada como revogada em 11 de janeiro de 2027 e sai da zona em 22 de março.

Um validador aprende a chave nova sozinho (RFC 5011) ou por atualização do software. Quem ficou com a âncora antiga fixa num arquivo passa a rejeitar tudo, e o sintoma é SERVFAIL pra internet inteira. A ICANN reconheceu relatos de problemas em um número limitado de sistemas.

A medição da APNIC mostra o resto. No mundo, a fatia de usuários atrás de resolvedor que valida subiu um pouco, de 39,7% pra 40,6%. No Brasil caiu de 54,7% em 11 de outubro pra 49,8% no dia 13, e seguia em 49,3% na média de 30 dias em meados de novembro. A APNIC diz que tentou falar com provedores brasileiros e não conseguiu. A minha leitura, sem ter como confirmar, é que parte dos operadores resolveu o SERVFAIL generalizado desligando a validação em vez de atualizar a âncora.

A próxima troca já tem plano: uma KSK ECDSA gerada em 2027 e a RSA aposentada em 2029.

### Quanto disso está em uso

- cerca de 40% dos usuários do mundo estão atrás de um resolvedor que valida
- no `.com`, 5,15% dos domínios são assinados (8,7 milhões de 168 milhões)
- no `.br`, 32%: 1,96 milhão de 6,1 milhões de domínios

A diferença do `.br` tem explicação. O DNS que o Registro.br oferece assina sozinho e não deixa desligar, e o DNSSEC é obrigatório em `b.br`, `bet.br`, `def.br`, `jus.br`, `leg.br`, `mp.br` e `tc.br`.

### O risco é operacional

DNSSEC troca um problema de segurança por um de operação. Assinatura vence, chave precisa ser trocada, e o DS na zona de cima precisa acompanhar. Quando isso falha, a zona some pra quem valida.

Em 5 de maio de 2026 foi a vez do `.de`. Um bug no sistema novo de assinatura da DENIC, durante uma troca de ZSK, gerou um par de chaves por HSM em vez de um só, todos com o mesmo key tag, e só um terço das assinaturas ficou válido. Por umas três horas, resolvedores que validam falharam pra todo o `.de`, inclusive pros domínios que nem usam DNSSEC, porque a prova de que eles não tinham DS também estava com assinatura inválida.

Do lado do validador também tem custo. O KeyTrap (CVE-2023-50387), divulgado em fevereiro de 2024, mostrou que uma única resposta montada com cuidado prendia um resolvedor por minutos, em alguns casos horas, conferindo assinaturas. Em 2026 apareceu um sucessor no Unbound, apelidado de ReTrap.

Eu assinaria uma zona hoje, com três condições: assinatura automática pelo provedor, monitoramento da validade dos RRSIG, e o cuidado de remover o DS e esperar o TTL dele (um dia no `.com` e no `.br`) antes de migrar de provedor. A parte de manter o DS em dia tem solução automática: a zona publica `CDS` e `CDNSKEY`, e o registry lê e atualiza sozinho (RFCs 7344, 8078 e 9615, com as recomendações de operação na RFC 10026, de julho de 2026).

## DNS cifrado {#dns-cifrado}

Uma consulta DNS tradicional é um datagrama UDP em texto puro. O provedor, o dono do Wi-Fi e qualquer equipamento no meio leem o nome que você pediu, e podem trocar a resposta.

{{< ilustra src="dns-cifrado.webp" alt="À esquerda, um mensageiro carrega um cartão-postal que três curiosos leem; à direita, o mesmo mensageiro passa por um túnel com um envelope lacrado e os curiosos não veem nada" caption="O mesmo recado, com e sem envelope." >}}

Três protocolos cifram o trecho entre você e o resolvedor recursivo:

{{< svg src="transportes.svg" caption="DNS em texto puro e os três transportes cifrados." >}}

**DoT** (DNS over TLS) é o DNS de sempre dentro de uma conexão TLS, numa porta só dele. Simples de implementar e fácil de bloquear: basta fechar a 853.

**DoH** (DNS over HTTPS) manda a mensagem DNS como corpo de uma requisição HTTP, na 443, misturada com o resto do tráfego web. É o que os navegadores usam e o que os quadros deste post usam. Sobre HTTP/3 ele já roda em cima de QUIC.

**DoQ** (DNS over QUIC) tira o HTTP do meio. Cada consulta vira um stream independente, então uma resposta lenta não segura as outras.

### O que isso esconde, e de quem

Cifrar o transporte esconde a consulta de quem está no caminho. Não esconde do resolvedor, que continua vendo tudo o que você pede. Usar DoH com um resolvedor público é trocar em quem você confia: sai o seu provedor, entra a Cloudflare ou o Google.

Sobram dois vazamentos.

O primeiro é o trecho do recursivo até os autoritativos, que continua quase todo em texto puro. QNAME minimisation reduz o que cada servidor fica sabendo, e existe uma RFC experimental (9539) pra cifrar esse trecho quando o autoritativo aceitar. Fazer isso direito depende de a delegação dizer que o servidor fala TLS, e esse é um dos motivos do [DELEG](#o-que-vem).

O segundo é o TLS do próprio site. O nome do servidor vai em claro no começo do handshake, no campo SNI, então quem olha a rede vê `www.exemplo.com` mesmo sem ver o DNS. A correção é o Encrypted Client Hello, que virou padrão em março de 2026 (RFC 9849). A chave pra cifrar o ClientHello vem pelo DNS, no parâmetro `ech` do registro HTTPS (RFC 9848):

```text
$ dig crypto.cloudflare.com https +short
1 . alpn="h2" ipv4hint=104.18.6.137,104.18.7.137 ech=AEX+DQBB/wAgACCyaO2J1nPI3R/fl8t5C0mR... ipv6hint=2606:4700::6812:689,2606:4700::6812:789
```

Daí a dependência: ECH só faz sentido com DNS cifrado, senão o nome vaza na consulta. O Chrome tem ECH ligado por padrão desde a versão 117. O Firefox liga quando o DoH está ativo. O Safari, até onde consegui verificar, ainda manda o SNI em claro.

Tem ainda o **EDNS Client Subnet** (RFC 7871), que anda no sentido contrário da privacidade: o recursivo conta ao autoritativo um pedaço do seu endereço, pra CDN escolher um servidor perto de você. O Google manda. A Cloudflare não manda, por decisão de privacidade.

### Onde já vem ligado

- **Android**: "DNS privado" nas configurações é DoT desde o Android 9. A partir do 11, com Google e Cloudflare, o sistema usa DoH sobre HTTP/3
- **iOS e macOS**: DoT e DoH por perfil de configuração ou por app desde iOS 14 e macOS 11
- **Windows 11**: DoH nativo no cliente, com Cloudflare, Google e Quad9 pré-cadastrados. O servidor DNS do Windows ganhou DoH em junho de 2026
- **Linux**: o systemd-resolved fala DoT (`DNSOverTLS=yes` ou `opportunistic`) e não fala DoH
- **Firefox**: DoH por padrão nos Estados Unidos e em mais alguns países
- **Chrome**: usa DoH quando o resolvedor configurado no sistema oferece o serviço

Pra rede descobrir sozinha que o resolvedor fala cifrado existem dois mecanismos de 2023: DDR (RFC 9462), em que o cliente pergunta `_dns.resolver.arpa` ao resolvedor que já tem, e DNR (RFC 9463), em que a informação vem pelo DHCP ou pelo anúncio do roteador.

### O que quebra

DoH no navegador ignora o resolvedor da rede. Isso é o objetivo em Wi-Fi de aeroporto e um problema em rede corporativa, onde o resolvedor interno conhece nomes que não existem fora (split-horizon) e é o ponto onde se aplica filtro e se guarda log. O que os navegadores fazem hoje é desligar o DoH automático quando detectam política corporativa ou controle parental, e é bom conferir se a sua rede sinaliza isso.

Em rede que eu não controlo, eu ligaria DoT ou DoH no sistema operacional, e não só no navegador, pra cobrir todos os programas. Em rede minha, eu poria um recursivo local validando DNSSEC e falando DoT com quem ele consulta.

## DNS no Linux e no Kubernetes {#linux-e-kubernetes}

Quando uma aplicação no Linux resolve um nome, o DNS é só uma das fontes consultadas, e nem é a primeira.

{{< svg src="linux.svg" caption="O caminho de um `getaddrinfo()` numa distribuição com systemd-resolved." >}}

A aplicação chama `getaddrinfo()`. A glibc lê a linha `hosts:` do `/etc/nsswitch.conf` e consulta as fontes na ordem. `files` é o `/etc/hosts`. `resolve` fala com o systemd-resolved. `dns` é o resolver da própria glibc, que lê o `/etc/resolv.conf`.

A consequência mais útil pra troubleshooting: **`dig`, `host` e `nslookup` não passam por nada disso**. Eles leem o `resolv.conf` e falam DNS direto. Quando o `dig` resolve e a aplicação não, compare com o caminho que a aplicação usa:

```bash
getent ahosts www.leandrosf.com
```

Se o `getent` falha e o `dig` funciona, o problema está no NSS, no `/etc/hosts` ou na search list, e não no DNS.

### resolv.conf

```text
nameserver 127.0.0.53
search exemplo.com.br
options ndots:1 timeout:5 attempts:2
```

O que vale saber:

- a glibc usa no máximo **três** `nameserver`. O quarto é ignorado em silêncio
- eles são tentados em ordem, e o segundo só entra depois que o primeiro estourar o `timeout` (5 segundos por padrão). Não é balanceamento, é contingência lenta. A opção `rotate` alterna entre eles
- `ndots:n` decide se o nome é tentado puro antes ou depois da search list (padrão 1)
- `single-request` e `single-request-reopen` fazem as consultas A e AAAA saírem uma depois da outra em vez de em paralelo pelo mesmo socket, o que contorna firewall e NAT que se perdem com as duas juntas
- `use-vc` força TCP, `edns0` liga EDNS, `trust-ad` faz a glibc repassar a flag AD, e `no-aaaa` (glibc 2.36) suprime as consultas AAAA

A **musl**, que é a libc do Alpine, se comporta diferente: consulta todos os nameservers em paralelo e fica com a primeira resposta, não tem `single-request`, e só passou a repetir por TCP quando a resposta vem cortada na versão 1.2.4, de 2023. Imagem Alpine antiga que não resolve um nome com muitos registros geralmente é isso.

### systemd-resolved

Em Ubuntu, Fedora e em boa parte das distribuições atuais, o `resolv.conf` aponta pra `127.0.0.53`, que é o stub do systemd-resolved. Ele tem cache, sabe qual servidor DNS pertence a qual interface (o que importa com VPN) e pode falar DoT. O estado de verdade não está no `resolv.conf`:

```bash
resolvectl status
resolvectl query www.leandrosf.com
resolvectl flush-caches
```

### Dentro de um pod

No Kubernetes o kubelet escreve o `resolv.conf` do pod. Com a política padrão (`ClusterFirst`), num pod do namespace `default`:

```text
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

O `ndots:5` existe pra que `redis`, `redis.cache` e `redis.cache.svc` resolvam como nomes do cluster. O preço é que qualquer nome com menos de cinco pontos passa primeiro pela search list inteira:

{{< dns lab="ndots" titulo="O que o resolver do pod realmente pergunta" >}}

Uma chamada pra `api.github.com` vira oito consultas, seis delas com NXDOMAIN garantido. Num serviço que abre muitas conexões pra fora, o CoreDNS passa a maior parte do tempo dizendo "não existe". As saídas, da mais barata pra mais invasiva:

- escrever o nome externo com ponto no fim (`api.github.com.`) na configuração da aplicação
- baixar o `ndots` daquele workload pelo `dnsConfig` do pod

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
```

- pôr um cache de DNS por node (NodeLocal DNSCache)

O servidor do outro lado é o CoreDNS. O Corefile que o kubeadm instala:

```text
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30 {
       disable success cluster.local
       disable denial cluster.local
    }
    loop
    reload
    loadbalance
}
```

Dois detalhes ali contrariam o que se costuma repetir. O plugin `kubernetes` tem TTL padrão de 5 segundos, mas o kubeadm configura 30. E o `cache 30` vem com o cache desligado pro domínio do cluster: nomes de Service saem sempre direto do plugin, e o cache só vale pro que é encaminhado pra fora.

O que mais dá problema em produção:

- **timeouts de 5 segundos intermitentes.** A e AAAA saem juntas pelo mesmo socket UDP, e uma corrida na tabela de conntrack do kernel durante o DNAT pode descartar uma das duas. A glibc espera o timeout e tenta de novo. O NodeLocal DNSCache evita o DNAT (o pod fala com um endereço link-local no próprio node, e o cache fala com o CoreDNS por TCP), e `single-request-reopen` contorna do lado do cliente
- **CoreDNS subdimensionado.** Ele escala com a quantidade de consultas, que cresce com o `ndots`. Vale olhar a métrica `coredns_dns_responses_total` por `rcode` antes de aumentar réplica: se a maioria é NXDOMAIN, o problema é search list
- **nome externo que muda de IP.** Aplicação com connection pool não refaz a resolução. O TTL do DNS não manda em conexão aberta

Service do tipo `ExternalName` é um CNAME servido pelo CoreDNS, e Service headless devolve um registro A por pod, sem IP virtual na frente. Os dois são DNS puro e sofrem de tudo o que está nesta seção.

## E-mail depende de DNS {#e-mail}

Entregar e-mail é, em boa parte, consultar DNS. Os registros envolvidos:

- **MX** diz quais servidores recebem e-mail do domínio, com prioridade. Sem MX, o remetente tenta o registro A do próprio domínio
- **SPF** é um TXT na raiz do domínio com a lista de quem pode enviar em nome dele. Tem um limite de 10 consultas DNS na avaliação, que se estoura fácil empilhando `include`
- **DKIM** publica a chave pública que assina as mensagens, num TXT em `seletor._domainkey.dominio`
- **DMARC** diz o que fazer quando SPF e DKIM falham e pra onde mandar relatório, num TXT em `_dmarc.dominio`. A especificação foi reescrita em maio de 2026: as RFCs 9989, 9990 e 9991 substituem a antiga 7489
- **MTA-STS** (RFC 8461) exige TLS na entrega, com um TXT em `_mta-sts` e uma política servida por HTTPS
- **DANE** faz o mesmo publicando o certificado esperado num registro TLSA, e só funciona com DNSSEC

Domínio que não envia e-mail também precisa de registro, pra ninguém enviar em nome dele: um SPF `v=spf1 -all`, um DMARC com `p=reject` e um MX nulo (`0 .`, RFC 7505).

## Implementações {#implementacoes}

O DNS não tem implementação de referência oficial, e isso é de propósito. A raiz roda de caso pensado sobre softwares diferentes, pra que um bug só não derrube todas as letras. O [relatório de diversidade de 2026](https://root-servers.org/media/news/2026-External_Diversity_Report.pdf) dos operadores lista BIND, Knot DNS, NSD e o ATLAS da Verisign. Perguntando a versão a cada letra daqui, por CHAOS, a A e a J respondem `"ATLAS"`, a B `"knot 3.x"`, a D e a L `"NSD 4"`, a K `"Knot DNS"`, e a G responde `"I-AM-GROOT"`.

O que existe pra rodar, com a versão estável de novembro de 2026:

{{< larga >}}

| Software | Papel | Quem mantém | Versão | O que tem de particular |
|---|---|---|---|---|
| [BIND 9](https://www.isc.org/bind/) | autoritativo e recursivo | ISC | 9.20.30 | O mais antigo e o mais completo. Nasceu em Berkeley nos anos 80. A linha 9.18 já está sem suporte |
| [Unbound](https://nlnetlabs.nl/projects/unbound/about/) | recursivo validador | NLnet Labs | 1.26.2 | O recursivo que eu poria numa rede hoje. Pequeno e focado em uma coisa |
| [NSD](https://nlnetlabs.nl/projects/nsd/about/) | autoritativo | NLnet Labs | 4.15.4 | Só serve zona, nada de recursão. Roda em root servers e TLDs |
| [Knot DNS](https://www.knot-dns.cz/) | autoritativo | CZ.NIC | 3.6.2 | Rápido, com assinatura DNSSEC automática. Traz o `kdig` |
| [Knot Resolver](https://www.knot-resolver.cz/) | recursivo | CZ.NIC | 6.5.1 | A série 6 trocou a configuração em Lua por YAML declarativo, com um processo gerente |
| [PowerDNS Authoritative](https://www.powerdns.com/) | autoritativo | PowerDNS | 5.1.5 | A zona pode morar num banco SQL ou em LMDB, e tem API HTTP |
| PowerDNS Recursor | recursivo | PowerDNS | 5.4.9 | Programável em Lua |
| [dnsdist](https://www.dnsdist.org/) | proxy e balanceador | PowerDNS | 2.1.3 | Fica na frente de outros servidores: balanceia, limita taxa e termina DoT, DoH e DoQ |
| [CoreDNS](https://coredns.io/) | servidor por plugins | CNCF | 1.15.0 | Em Go. Cada função é um plugin encadeado no Corefile. É o DNS do Kubernetes |
| [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html) | forwarder e DHCP | Simon Kelley | 2.93 | Está em roteador doméstico, no libvirt e no NetworkManager |
| [Technitium](https://technitium.com/dns/) | autoritativo e recursivo | Technitium | 15.6.2 | Em .NET, com painel web. Popular em homelab |
| [Hickory DNS](https://github.com/hickory-dns/hickory-dns) | cliente, servidor e resolvedor | comunidade, com apoio da ISRG | 0.26.3 | Em Rust (era o Trust-DNS). A documentação ainda não recomenda pra produção |
| Pi-hole, AdGuard Home, Blocky | forwarder com bloqueio | comunidade | | Respondem NXDOMAIN ou 0.0.0.0 pra domínios de anúncio e rastreio. O Pi-hole é um dnsmasq modificado |
| systemd-resolved | stub local | systemd | 262 | Cache e roteamento de DNS por interface na máquina. Não é servidor pra rede |
| Microsoft DNS | autoritativo e recursivo | Microsoft | Windows Server 2025 | Integrado ao Active Directory. Ganhou DoH em junho de 2026 |
| [djbdns](http://cr.yp.to/djbdns.html) | tinydns e dnscache | D. J. Bernstein | 1.05 | Sem versão nova há mais de vinte anos, em domínio público desde 2007. Já separava autoritativo e recursivo em programas diferentes quando isso não era o costume |

{{< /larga >}}

BIND, Unbound, NSD, Knot, PowerDNS e CoreDNS lançaram versão todos na mesma semana de outubro de 2026, e as notas de BIND e Unbound falam em correção de segurança. Lançamento coordenado assim é sinal de vulnerabilidade divulgada em conjunto, e mais um motivo pra não deixar servidor de DNS parado numa versão antiga.

Como escolher, sem rodeio:

- recursivo pra rede própria: Unbound ou Knot Resolver
- autoritativo servindo arquivo de zona: NSD ou Knot DNS
- autoritativo com API e zona em banco: PowerDNS
- precisa de tudo no mesmo binário, ou de views e split-horizon elaborados: BIND
- dentro do Kubernetes: CoreDNS, que já está lá
- rede de casa com bloqueio de anúncio: Pi-hole ou AdGuard Home apontando pra um Unbound

Já administrei BIND com split de DNS convivendo com Active Directory. Funciona, e é o tipo de configuração em que cada view vira um lugar a mais pra uma zona ficar desatualizada.

Pra quem programa, as bibliotecas que valem conhecer são a [dnspython](https://www.dnspython.org/), a [miekg/dns](https://codeberg.org/miekg/dns) em Go (é sobre ela que o CoreDNS é feito, e a versão 2 saiu do GitHub pro Codeberg), a [c-ares](https://c-ares.org/) em C e a [dnsjava](https://github.com/dnsjava/dnsjava).

## Resolvedores públicos {#resolvedores-publicos}

Qualquer um pode usar um recursivo público no lugar do que o provedor entrega. Os que importam:

{{< larga >}}

| Serviço | Endereços | DoH e DoT | Filtro | ECS | Observação |
|---|---|---|---|---|---|
| [Cloudflare](https://developers.cloudflare.com/1.1.1.1/) | `1.1.1.1`, `1.0.0.1`, `2606:4700:4700::1111` | `cloudflare-dns.com/dns-query`, `one.one.one.one` | `1.1.1.2` bloqueia malware, `1.1.1.3` malware e conteúdo adulto | não | No ar desde 1º de abril de 2018, em parceria com a APNIC. Apaga os logs em 25 horas |
| [Google Public DNS](https://developers.google.com/speed/public-dns) | `8.8.8.8`, `8.8.4.4`, `2001:4860:4860::8888` | `dns.google/dns-query`, `dns.google` | não | sim | Desde dezembro de 2009. Guarda o IP por 24 a 48 horas |
| [Quad9](https://quad9.net/) | `9.9.9.9`, `149.112.112.112`, `2620:fe::fe` | `dns.quad9.net/dns-query`, `dns.quad9.net` | bloqueia malware por padrão. `9.9.9.10` não bloqueia | só no `9.9.9.11` | Fundação sem fins lucrativos na Suíça |
| [OpenDNS](https://www.opendns.com/) | `208.67.222.222`, `208.67.220.220` | `doh.opendns.com/dns-query`, `dns.opendns.com` | FamilyShield em `208.67.222.123` | sim | Da Cisco. A versão corporativa, paga, é o Umbrella |
| [AdGuard DNS](https://adguard-dns.io/en/public-dns.html) | `94.140.14.14`, `94.140.15.15` | `dns.adguard-dns.com`, com DoQ | anúncio e rastreio. Sem filtro em `94.140.14.140` | sim | Tem plano pago com perfis próprios |
| [DNS4EU](https://www.joindns4.eu/for-public) | `86.54.11.100` sem filtro, `86.54.11.1` com proteção | `unfiltered.joindns4.eu`, `protective.joindns4.eu` | variantes pra criança e sem anúncio | não | Lançado em junho de 2025 com dinheiro da União Europeia |
| [NextDNS](https://nextdns.io/) | um endereço por perfil | `dns.nextdns.io/<perfil>` | você monta as listas | não | Grátis até 300 mil consultas por mês. Depois, R$ 7,90 por mês |
| [Control D](https://controld.com/free-dns) | `76.76.2.0`, `76.76.10.0` | `freedns.controld.com/p0`, com DoQ | perfis prontos: malware, anúncio, família | não | O perfil grátis não guarda log. O pago é por perfil próprio |

{{< /larga >}}

Todos os da tabela validam DNSSEC. O teste foi consultar `dnssec-failed.org` em cada um e ver se voltava SERVFAIL. Isso inclui o `9.9.9.10` do Quad9, que muita gente descreve como "sem DNSSEC". O que ele não tem é o bloqueio de malware. Quem não valida, pelo mesmo teste, são o AliDNS (`223.5.5.5`), os antigos `4.2.2.x` da Lumen e o filtro de segurança do CleanBrowsing.

No uso real a concentração é grande. Pela medição da APNIC de novembro de 2026, o Google resolve pra cerca de 12% dos usuários do mundo e a Cloudflare pra 4%. No Brasil o Google chega a 24% e a Cloudflare a 7%. Não achei nenhum resolvedor público brasileiro relevante: o NIC.br opera os autoritativos do `.br` e hospeda cópias de servidores raiz, mas não um recursivo aberto.

Dois casos recentes lembram que resolvedor gratuito acaba. O dns0.eu, criado em 2023 pelos fundadores do NextDNS, encerrou em outubro de 2025 dizendo que não era sustentável. Depois o domínio foi a leilão e hoje pertence a outra pessoa, então quem deixou `dns0.eu` configurado como DoH ou DoT em algum aparelho está apontando pra um nome com outro dono. E a Mullvad anunciou o fim do DNS público cifrado dela pra 2 de novembro de 2026, passando a patrocinar o Quad9.

Tem ainda a pressão legal. A OpenDNS saiu da França e de Portugal em 2024, e da Bélgica em 2025, em vez de cumprir ordens judiciais de bloqueio de sites de pirataria. O DNS4EU avisa que bloqueios por ordem judicial valem até no perfil sem filtro. Resolvedor é ponto de controle, e quem opera um está sujeito à lei de onde opera.

Na hora de escolher, eu olharia nesta ordem: quem opera e sob qual jurisdição, o que guarda de log, se valida DNSSEC, se tem ponto de presença perto (o `id.server` conta) e se manda client subnet. E configuraria dois, de operadores diferentes.

## DNS autoritativo como serviço {#dns-gerenciado}

Hospedar a própria zona em dois servidores com BIND ainda funciona. A maioria usa um serviço, e a faixa de preço vai de zero a contrato corporativo.

{{< larga >}}

| Serviço | Preço em novembro de 2026 | O que vale saber |
|---|---|---|
| [Registro.br](https://registro.br/) | grátis pra domínio `.br` | DNSSEC automático e obrigatório. Publica a cada 5 minutos |
| [Cloudflare](https://www.cloudflare.com/application-services/products/dns/) | grátis, sem cobrança por consulta | Zona nova no plano grátis tem limite de 200 registros. CNAME flattening em todos os planos. Transferência de zona só no Enterprise |
| [deSEC](https://desec.io/) | grátis, sem fins lucrativos | DNSSEC sempre ligado, API REST, DNS dinâmico em `dedyn.io` |
| [Hurricane Electric](https://dns.he.net/) | grátis | Aceita ser secundário da sua zona. Sem DNSSEC, pelo que a documentação diz |
| [Hetzner DNS](https://www.hetzner.com/dns/) | grátis | Migrou pro console novo em 2026. Sem DNSSEC |
| [Bunny DNS](https://bunny.net/dns/) | consultas grátis desde junho de 2026 | Vale o mínimo de US$ 1 por mês da conta. Tem GeoDNS e health check |
| [ClouDNS](https://www.cloudns.net/) | grátis com 1 zona, pagos a partir de US$ 2,95 por mês | DNSSEC só nos planos pagos |
| [AWS Route 53](https://aws.amazon.com/route53/pricing/) | US$ 0,50 por zona por mês e US$ 0,40 por milhão de consultas | Alias pra recurso da AWS não cobra consulta. Roteamento por latência e geografia custa mais. No DNSSEC, a KSK fica numa chave KMS sua |
| [Google Cloud DNS](https://cloud.google.com/dns/pricing) | US$ 0,20 por zona e US$ 0,40 por milhão | DNSSEC gerenciado |
| [Azure DNS](https://azure.microsoft.com/en-us/pricing/details/dns/) | US$ 0,50 por zona e US$ 0,40 por milhão | Sem transferência de zona. Roteamento geográfico fica em outro produto |
| [DNSimple](https://dnsimple.com/pricing) | US$ 0,50 por zona, com plano individual grátis | ALIAS e DNSSEC em todos os planos |
| [Gcore](https://gcore.com/dns) | grátis, Pro a € 2,49 por mês | GeoDNS já no plano grátis |
| [IBM NS1 Connect](https://www.ibm.com/products/ns1-connect/pricing) | a partir de US$ 108 por mês | Roteamento de tráfego programável. Não tem mais plano grátis permanente |
| Akamai Edge DNS, DigiCert UltraDNS | sob consulta | Pra quem precisa de SLA de 100% no contrato |

{{< /larga >}}

O mercado encolheu por aquisição. A DigiCert hoje é dona do UltraDNS (comprou a Vercara em setembro de 2024), do DNS Made Easy e do Constellix. A Dyn, que em 2016 era a referência, foi comprada pela Oracle, e o produto principal dela foi aposentado em maio de 2023.

O que comparar além do preço:

- **DNSSEC**: se é um botão ou um projeto. No Route 53 é um projeto
- **ALIAS ou flattening na raiz da zona**, se o seu site está atrás de CDN ou load balancer
- **transferência de zona (AXFR)**, de entrada e de saída. É o que permite ter um segundo provedor sem ferramenta de sincronização
- **API e provider de Terraform ou OpenTofu**. Zona editada na mão em painel é zona sem histórico
- **GeoDNS e health check**, se você faz failover por DNS

A maior parte dos incidentes da seção sobre [quedas](#quando-cai) teria doído menos com dois provedores. O jeito simples é um primário que aceite AXFR de saída e um secundário que aceite de entrada. O jeito trabalhoso é publicar a mesma zona nos dois por API, o que com DNSSEC exige combinar as chaves (RFC 8901).

Pra endereço que muda, como o de casa, existem os serviços de DNS dinâmico: [DuckDNS](https://www.duckdns.org/) e [deSEC](https://desec.io/) são grátis, o [Dynu](https://www.dynu.com/) dá quatro nomes de graça e o [No-IP](https://www.noip.com/) dá um, que precisa ser confirmado todo mês.

## Ataques {#ataques}

O DNS é atacado de quatro jeitos, e cada um pede uma defesa diferente.

### Envenenar o cache

O alvo é o recursivo. O atacante faz ele perguntar alguma coisa e tenta entregar uma resposta falsa antes da verdadeira. Se colar, o recursivo guarda a mentira pelo TTL que o atacante escolheu e a serve pra todos os clientes.

Em 2008, Dan Kaminsky mostrou como fazer isso em segundos contra qualquer recursivo da época (CVE-2008-1447), e a resposta foi sortear a porta de origem. Em 2020 o SAD DNS (CVE-2020-25705) achou um jeito de descobrir essa porta usando o limite global de mensagens ICMP do kernel como canal lateral. Em outubro de 2025 o BIND corrigiu duas falhas de envenenamento com nota 8.6 (CVE-2025-40778 e CVE-2025-40780), e o Unbound outra no mesmo dia.

2026 foi um ano pesado pra quem opera recursivo. A matriz de segurança da ISC lista 37 CVEs no BIND em cinco lotes, e a NLnet Labs publicou mais de 40 no Unbound em quatro versões. Manter recursivo atualizado deixou de ser opcional faz tempo, e este ano foi mensal.

A defesa estrutural é DNSSEC: resposta forjada não tem assinatura válida. O resto (porta aleatória, cookies, 0x20) só encarece o ataque.

### Usar o DNS como arma

Uma pergunta DNS pequena pode gerar uma resposta dezenas de vezes maior, e por UDP o endereço de origem é fácil de falsificar. O atacante manda consultas com o IP da vítima como origem pra milhares de servidores abertos, e a vítima recebe as respostas. É a amplificação por reflexão.

Não ser parte do problema é simples: recursivo não deve atender a internet inteira, e autoritativo deve ter limite de taxa de resposta (RRL).

### Derrubar o DNS de alguém

Se os autoritativos de uma zona caem, tudo o que depende dela cai junto quando os caches vencem. Em 21 de outubro de 2016 a botnet Mirai, feita de câmeras e roteadores, derrubou a Dyn em duas ondas, e Twitter, GitHub, Netflix e Reddit ficaram inalcançáveis pra boa parte dos Estados Unidos sem terem sido atacados.

Uma variação mais difícil de filtrar é o ataque de subdomínio aleatório: milhares de consultas por nomes inventados (`x7f3k.vitima.com`), que nunca estão em cache e sempre chegam ao autoritativo, passando por recursivos legítimos.

A defesa é não ter um ponto único: mais de um provedor de DNS autoritativo, anycast, e TTLs que deem tempo de reagir.

### Roubar o nome

Às vezes o DNS funciona perfeitamente e responde o que o atacante mandou.

- **Conta do registrar comprometida.** Quem troca os NS no registrar controla o domínio. Autenticação forte e registry lock valem mais que qualquer configuração de zona
- **Sequestro de rota.** Em abril de 2018, um anúncio BGP falso desviou endereços do Route 53, e quem consultava um site de carteira de criptomoeda recebeu o IP de um servidor falso
- **CNAME órfão.** O registro aponta pra um recurso de nuvem que foi apagado (um bucket, um app, um site estático). Quem recriar o recurso com o mesmo nome passa a servir conteúdo no seu subdomínio. Apagar o recurso sem apagar o registro é o erro
- **Nomes parecidos.** Typosquatting e, com IDN, letras de outros alfabetos que parecem iguais às latinas

### Usar o DNS como túnel

Como quase toda rede deixa DNS sair, dá pra codificar dados em nomes de consulta e em respostas TXT. Ferramentas como o iodine montam um túnel IP inteiro assim. É lento, funciona em Wi-Fi com portal de login, e é um canal clássico de exfiltração. O sinal é sempre parecido: muitos nomes longos e aleatórios sob um mesmo domínio.

## Quando o DNS cai {#quando-cai}

{{< ilustra src="sempre-dns.webp" alt="Um quadro de investigação em que fios vermelhos ligam servidor, nuvem, banco de dados, switch, cadeado e foguete a um único cartão com uma placa de direções; ao lado, um engenheiro cansado com uma caneca" caption="Todo postmortem tem um fio que passa por ele." >}}

Cinco incidentes que valem a leitura do relatório oficial.

**Dyn, 21 de outubro de 2016.** O DDoS da Mirai descrito acima. A lição que ficou foi a do provedor único: quem tinha um segundo provedor de DNS autoritativo passou quase ileso.

**Facebook, 4 de outubro de 2021.** Um comando de manutenção derrubou o backbone interno. Os servidores DNS da empresa, ao perceberem que não alcançavam os datacenters, retiraram os próprios anúncios BGP, como foram projetados pra fazer. Pra quem estava de fora, o DNS do Facebook sumiu por quase seis horas. Não era um problema de DNS, e foi no DNS que ele apareceu.

**Cloudflare 1.1.1.1, 14 de julho de 2025.** Sessenta e dois minutos fora do ar no mundo inteiro. Uma configuração errada, feita semanas antes, ligou os prefixos do resolvedor a um serviço que não estava em produção. Uma mudança sem relação ativou o erro e os prefixos foram retirados globalmente. Quem tinha só 1.1.1.1 e 1.0.0.1 configurados ficou sem DNS.

**AWS us-east-1, 20 de outubro de 2025.** Uma condição de corrida entre dois componentes da automação de DNS do DynamoDB fez um plano antigo sobrescrever o novo, e a limpeza apagou o plano. O endpoint regional do DynamoDB ficou com um registro DNS vazio. O DNS foi consertado em menos de três horas, e o evento inteiro levou mais de catorze, porque meio mundo dentro da AWS depende do DynamoDB.

**DENIC, 5 de maio de 2026.** A queda do `.de` contada na seção de DNSSEC.

O que eles têm em comum é que o DNS raramente é a causa primeira. Ele é a dependência que todo o resto tem, então é onde a falha de outra coisa fica visível pra todo mundo ao mesmo tempo.

O que dá pra fazer do seu lado:

- dois provedores de DNS autoritativo, ou pelo menos um secundário fora do principal
- no cliente e nos servidores, resolvedores de operadores diferentes. `1.1.1.1` e `1.0.0.1` são o mesmo serviço
- monitorar a resolução de fora da sua rede, e separar na métrica NXDOMAIN, SERVFAIL e timeout
- serve-stale no recursivo interno, pra atravessar uma queda curta do autoritativo
- TTL que combine com o seu tempo de reação. TTL de 60 segundos em tudo significa que uma queda de dez minutos do seu DNS derruba tudo em um minuto

## Ferramentas e troubleshooting {#ferramentas}

O `dig` é a ferramenta que vale aprender. A saída completa de uma consulta:

```text
$ dig @1.1.1.1 www.leandrosf.com

;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 3624
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;www.leandrosf.com.             IN      A

;; ANSWER SECTION:
www.leandrosf.com.      300     IN      A       172.67.200.25
www.leandrosf.com.      300     IN      A       104.21.21.202

;; Query time: 20 msec
;; SERVER: 1.1.1.1#53(1.1.1.1) (UDP)
;; MSG SIZE  rcvd: 78
```

Lê-se de cima pra baixo: o `status` é o RCODE, as `flags` dizem que é uma resposta (`qr`), que pedi recursão (`rd`) e que o servidor oferece (`ra`). Não tem `aa` porque veio de um recursivo, nem `ad` porque a zona não é assinada. O `udp: 1232` é o buffer EDNS que o servidor anunciou. No fim, quem respondeu, por qual transporte e em quanto tempo.

As variações que mais servem:

```bash
dig +short www.leandrosf.com            # só o dado
dig leandrosf.com ns                    # outro tipo
dig @dawn.ns.cloudflare.com www.leandrosf.com +norec   # direto no autoritativo, sem recursão
dig +trace www.leandrosf.com            # refaz a delegação desde a raiz
dig -x 1.1.1.1                          # reverso
dig +dnssec registro.br                 # traz os RRSIG
dig +cd dnssec-failed.org               # pede pro resolvedor não validar
dig +tcp leandrosf.com                  # força TCP
dig +nsid @1.1.1.1 leandrosf.com        # qual instância respondeu
dig +tls @1.1.1.1 leandrosf.com         # DNS over TLS (BIND 9.18 em diante)
dig +https @1.1.1.1 leandrosf.com       # DNS over HTTPS
dig @1.1.1.1 ch txt id.server +short    # o ponto de presença do resolvedor
```

O último respondeu `"gru14"` daqui: o 1.1.1.1 que me atende é o de São Paulo (GRU é o código do aeroporto de Guarulhos).

Outras que valem ter:

- `delv`: valida DNSSEC localmente e diz por que falhou
- `kdig`, do Knot DNS: um `dig` com DoT, DoH e DoQ desde sempre
- [`doggo`](https://github.com/mr-karan/doggo) e [`q`](https://github.com/natesales/q): clientes modernos em Go, com saída colorida, JSON e todos os transportes cifrados
- `resolvectl query`: resolve pelo caminho do systemd-resolved
- `getent ahosts nome`: resolve pelo caminho que as aplicações usam
- `tcpdump -ni any port 53`: quando nada mais faz sentido, olhar o que realmente saiu
- [DNSViz](https://dnsviz.net/) e [Zonemaster](https://zonemaster.net/): desenham a cadeia de DNSSEC e testam a delegação de fora

### Um roteiro

Quando "o DNS não funciona", esta é a ordem em que eu olharia, do mais provável pro menos.

**1. É resolução ou é conexão?** `getent ahosts nome`. Se devolve o IP certo, o DNS já fez a parte dele e o problema é de rede, firewall ou aplicação.

**2. `getent` falha e `dig` funciona.** O problema está antes do DNS: `/etc/hosts`, `nsswitch.conf`, search list ou `ndots`. Teste com o ponto no fim do nome.

**3. O recursivo responde diferente do autoritativo.** Pergunte pros dois:

```bash
dig nome
dig @servidor-autoritativo nome +norec
```

Se o autoritativo tem o dado novo e o recursivo o antigo, é cache, e o TTL que o recursivo mostra diz quanto falta. Se os autoritativos discordam entre si, a zona não foi copiada pra todos os secundários, e o serial do SOA de cada um confirma.

**4. NXDOMAIN, SERVFAIL ou timeout.** São três problemas diferentes:

- NXDOMAIN: o nome não existe, ou não existia quando alguém perguntou e a negativa está em cache
- SERVFAIL: o recursivo não conseguiu resposta confiável. Repita com `+cd`. Se funcionar, é DNSSEC: assinatura vencida, DS sem chave correspondente, relógio errado no validador
- timeout: ninguém respondeu. Firewall, rota, ou o servidor fora

**5. Funciona por UDP e falha em alguns nomes.** Resposta grande cortada e TCP bloqueado. `dig +tcp` confirma.

**6. Funciona de um lugar e não de outro.** Resposta diferente por origem (GeoDNS, split-horizon, client subnet) ou um resolvedor com cache envenenado ou filtrando. Compare o mesmo nome em dois resolvedores públicos e no autoritativo.

## Curiosidades {#curiosidades}

**De onde veio.** Antes do DNS, os nomes da ARPANET ficavam num arquivo só, o `HOSTS.TXT`, mantido à mão e baixado por todo mundo. Paul Mockapetris publicou a proposta do DNS em novembro de 1983, nas RFCs 882 e 883. O BIND saiu de Berkeley em 1984, como projeto de alunos de pós-graduação com verba da DARPA.

**O primeiro .com** é `symbolics.com`, registrado em 15 de março de 1985. O `.br` foi delegado por Jon Postel em 1989 à equipe da Fapesp.

**A conta dos 13 servidores raiz.** Uma resposta com os 13 NS e os 13 endereços IPv4 ocupa 436 bytes: 12 do cabeçalho, 5 da pergunta, 31 do primeiro NS, 15 de cada um dos outros doze (a compressão de nomes faz o serviço) e 16 de cada registro A. Pela aritmética caberiam 15 em 512 bytes. Ficaram 13, com folga. Hoje, com IPv6 e EDNS, a mesma resposta tem 811 bytes.

**As "sete chaves da internet"** não existem do jeito que as matérias contam. A chave da raiz fica em módulos de hardware em duas instalações nos Estados Unidos, uma na Califórnia e outra na Virgínia. São 14 Crypto Officers, sete por instalação, e ativar o módulo exige três deles presentes, numa cerimônia trimestral transmitida ao vivo. Outras sete pessoas guardam pedaços da chave que cifra o backup, e precisam de cinco pra reconstruir. Nenhum cartão sozinho abre nada, e sem entrar no prédio da ICANN ele não serve pra coisa nenhuma.

**As classes esquecidas.** O campo de classe quase sempre vale `IN`. As outras duas que sobraram são `CH` (Chaosnet, uma rede do MIT dos anos 70) e `HS` (Hesiod). A CH virou o canal pra perguntar coisas ao próprio servidor: `version.bind`, `hostname.bind`, `id.server`.

**Nomes que nunca vão pra internet.** `.test`, `.example`, `.invalid` e `.localhost` são reservados desde 1999. `.local` é do mDNS. `home.arpa` é pra rede doméstica. `.onion` é do Tor e `.alt` é pra sistemas de nomes fora do DNS. Em julho de 2024 a ICANN reservou `.internal` pra uso privado, que é o que você deveria usar em vez de inventar um TLD. Inventar dá errado: `.corp`, `.home` e `.mail` eram tão usados em redes internas que a ICANN desistiu de delegá-los, e quem usava `.dev` em ambiente local descobriu em 2017 que o TLD era do Google, que pôs ele inteiro na lista de HSTS do Chrome.

**O dia em que o `.com` respondeu por tudo.** Em setembro de 2003 a Verisign pôs um wildcard em `.com` e `.net`: qualquer domínio não registrado passou a resolver pra uma página de busca com anúncios dela, o Site Finder. Filtro de spam, verificação de erro de digitação e um monte de software que dependia de NXDOMAIN quebraram. A ICANN mandou tirar e o wildcard saiu em 4 de outubro.

**DNS como banco de dados de qualquer coisa.** O [dns.toys](https://www.dns.toys/) responde hora, câmbio e conta de cabeça por DNS: `dig mumbai.time @dns.toys`, `dig 100USD-INR.fx @dns.toys`. Durante 15 anos deu pra ler resumo da Wikipédia com `dig txt termo.wp.dg.cx`. E em 2018 Ben Cox mostrou o [DNSFS](https://blog.benjojo.co.uk/post/dns-filesystem-true-cloud-storage-dnsfs), que guarda arquivos no cache de resolvedores alheios.

**Emoji em domínio** é proibido pela norma de nomes internacionalizados. Alguns ccTLDs vendem mesmo assim, e a ICANN desaconselha.

**O haicai.** "It's not DNS / There's no way it's DNS / It was DNS" apareceu num comentário do usuário SSBroski no r/sysadmin, em 17 de junho de 2016.

**Os números de 2026.** São 411,6 milhões de nomes de domínio registrados no mundo, dos quais 169,8 milhões em `.com`. A marca de 400 milhões foi passada no segundo trimestre. O `.br` tem 6,1 milhões e é o sexto maior TLD de país. Os servidores raiz respondem cerca de 1,6 milhão de consultas por segundo. A Cloudflare dizia em 2025 que o 1.1.1.1 atendia 1,9 trilhão por dia.

**TLDs com futuro incerto.** O `.io` pertence ao Território Britânico do Oceano Índico, que o Reino Unido negocia devolver às Ilhas Maurício. Se o código de país sumir da ISO 3166, o TLD entra em processo de aposentadoria. Por enquanto segue igual, porque a lei britânica que implementaria o tratado caducou em abril de 2026. O `.su`, da União Soviética, sobrevive há 35 anos ao país. E os domínios grátis `.tk`, `.cf` e `.gq` sumiram aos milhões em 2024, quando a Freenom fechou um acordo judicial com a Meta.

## O que vem por aí {#o-que-vem}

**DELEG.** A delegação de hoje é um par de registros NS com glue, e não tem onde dizer "este servidor fala TLS" ou "esta zona é operada por tal provedor, pergunte a ele os detalhes". O DELEG é um registro novo de delegação que carrega esses parâmetros. Em novembro de 2026 ele ainda é draft (`draft-ietf-deleg-13`, em última chamada no grupo de trabalho), ganhou códigos temporários na IANA em outubro e tem implementações experimentais em BIND, Knot e dnspython. É a mudança mais profunda no núcleo do protocolo em décadas, e vai levar anos pra chegar em produção.

**Criptografia pós-quântica no DNSSEC.** O algoritmo 18 (ML-DSA-44) já está no registro, e a raiz tem plano de migrar a KSK de RSA pra ECDSA entre 2027 e 2029. O obstáculo é o tamanho das assinaturas pós-quânticas, que não cabem em UDP.

**Erros estruturados.** O draft que deixa um resolvedor explicar por que bloqueou um nome (filtro, ordem judicial, malware), em formato que o navegador entende, está na fila de publicação do RFC Editor.

**Menos consultas.** A RFC 10029, de julho de 2026, permite pedir vários tipos na mesma mensagem. A e AAAA numa pergunta só resolve de uma vez metade dos problemas da seção de Kubernetes, quando os clientes adotarem.

**Mais TLDs.** A ICANN reabriu a janela de novos gTLDs entre abril e agosto de 2026 e revelou 1.615 candidaturas em outubro. Nenhuma foi delegada ainda, mas a zona raiz vai crescer de novo.

## Referências {#referencias}

Tudo o que está neste post saiu de algum destes lugares, ou foi medido com `dig`.

### As RFCs que valem a leitura

Bert Hubert contou 185 RFCs de DNS em 2018, e a lista só cresceu. Estas são as que eu leria, na ordem.

**Base**

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) e [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035): conceitos e especificação (1987). Ainda são o padrão
- [RFC 2181](https://www.rfc-editor.org/rfc/rfc2181): esclarecimentos, incluindo RRset e TTL
- [RFC 2308](https://www.rfc-editor.org/rfc/rfc2308): cache de respostas negativas
- [RFC 8020](https://www.rfc-editor.org/rfc/rfc8020): NXDOMAIN quer dizer que não tem nada embaixo
- [RFC 9499](https://www.rfc-editor.org/rfc/rfc9499): a terminologia, de 2024. É o melhor ponto de entrada pra quem quer falar a língua certa
- [RFC 9471](https://www.rfc-editor.org/rfc/rfc9471): glue em referrals

**Transporte**

- [RFC 6891](https://www.rfc-editor.org/rfc/rfc6891): EDNS(0)
- [RFC 7766](https://www.rfc-editor.org/rfc/rfc7766) e [RFC 9210](https://www.rfc-editor.org/rfc/rfc9210): DNS sobre TCP, implementação e operação
- [RFC 9715](https://www.rfc-editor.org/rfc/rfc9715): como evitar fragmentação em DNS sobre UDP
- [RFC 7873](https://www.rfc-editor.org/rfc/rfc7873): cookies
- [RFC 8914](https://www.rfc-editor.org/rfc/rfc8914): Extended DNS Errors
- [RFC 8767](https://www.rfc-editor.org/rfc/rfc8767): serve-stale
- [RFC 10029](https://www.rfc-editor.org/rfc/rfc10029): vários tipos na mesma pergunta

**DNSSEC**

- [RFC 9364](https://www.rfc-editor.org/rfc/rfc9364): o guia de leitura do DNSSEC, que aponta pras outras
- [RFC 4033](https://www.rfc-editor.org/rfc/rfc4033), [4034](https://www.rfc-editor.org/rfc/rfc4034) e [4035](https://www.rfc-editor.org/rfc/rfc4035): a especificação
- [RFC 5155](https://www.rfc-editor.org/rfc/rfc5155) e [RFC 9276](https://www.rfc-editor.org/rfc/rfc9276): NSEC3 e como configurar
- [RFC 9824](https://www.rfc-editor.org/rfc/rfc9824): Compact Denial of Existence
- [RFC 7344](https://www.rfc-editor.org/rfc/rfc7344), [8078](https://www.rfc-editor.org/rfc/rfc8078), [9615](https://www.rfc-editor.org/rfc/rfc9615) e [10026](https://www.rfc-editor.org/rfc/rfc10026): automação do DS
- [RFC 9904](https://www.rfc-editor.org/rfc/rfc9904), [9905](https://www.rfc-editor.org/rfc/rfc9905) e [9906](https://www.rfc-editor.org/rfc/rfc9906): algoritmos recomendados, fim do SHA-1 e do GOST

**Privacidade**

- [RFC 9076](https://www.rfc-editor.org/rfc/rfc9076): o que vaza numa consulta DNS
- [RFC 9156](https://www.rfc-editor.org/rfc/rfc9156): QNAME minimisation
- [RFC 7858](https://www.rfc-editor.org/rfc/rfc7858), [8484](https://www.rfc-editor.org/rfc/rfc8484) e [9250](https://www.rfc-editor.org/rfc/rfc9250): DoT, DoH e DoQ
- [RFC 9462](https://www.rfc-editor.org/rfc/rfc9462) e [9463](https://www.rfc-editor.org/rfc/rfc9463): descoberta de resolvedor cifrado
- [RFC 9460](https://www.rfc-editor.org/rfc/rfc9460): registros SVCB e HTTPS
- [RFC 9849](https://www.rfc-editor.org/rfc/rfc9849) e [9848](https://www.rfc-editor.org/rfc/rfc9848): Encrypted Client Hello e a chave publicada no DNS
- [RFC 7871](https://www.rfc-editor.org/rfc/rfc7871): EDNS Client Subnet

**E-mail**

- [RFC 7208](https://www.rfc-editor.org/rfc/rfc7208) (SPF), [RFC 6376](https://www.rfc-editor.org/rfc/rfc6376) (DKIM), [RFC 9989](https://www.rfc-editor.org/rfc/rfc9989) (DMARC), [RFC 8461](https://www.rfc-editor.org/rfc/rfc8461) (MTA-STS) e [RFC 6698](https://www.rfc-editor.org/rfc/rfc6698) (DANE)

O que ainda não é RFC: [draft-ietf-deleg](https://datatracker.ietf.org/doc/draft-ietf-deleg/) e [draft-ietf-dnsop-delext](https://datatracker.ietf.org/doc/draft-ietf-dnsop-delext/).

### Dados e medições

- [root-servers.org](https://root-servers.org/): instâncias de cada letra, com mapa, e os relatórios de incidente da raiz
- [IANA, âncoras de confiança e cerimônias da raiz](https://www.iana.org/dnssec/files) e a [lista de TLDs](https://data.iana.org/TLD/tlds-alpha-by-domain.txt)
- [IANA, parâmetros do DNS](https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml) e [algoritmos de DNSSEC](https://www.iana.org/assignments/dns-sec-alg-numbers/dns-sec-alg-numbers.xhtml): os registros de tipos, RCODEs e algoritmos
- [APNIC Labs, validação DNSSEC](https://stats.labs.apnic.net/dnssec/XA) (e [só o Brasil](https://stats.labs.apnic.net/dnssec/BR)) e [uso de resolvedores](https://stats.labs.apnic.net/rvrs/XA)
- [APNIC, "Rolling the root key: what happened"](https://blog.apnic.net/2026/10/21/rolling-the-root-key-what-happened/) e o [comunicado da ICANN](https://www.icann.org/en/announcements/details/icann-reports-root-zone-ksk-rollover-completed-as-planned-15-10-2026-en) sobre a troca da KSK
- [Registro.br, estatísticas](https://registro.br/dominio/estatisticas/), [categorias com DNSSEC obrigatório](https://registro.br/tecnologia/dnssec/dns-e-dnssec/dominios-dnssec-obrigatorio/) e [características técnicas](https://registro.br/tecnologia/caracteristicas-tecnicas/)
- [StatDNS](https://www.statdns.com/): contagem de domínios assinados por TLD
- [DNS Flag Day 2020](https://www.dnsflagday.net/2020/): de onde vem o 1232

### Relatórios de incidente e de vulnerabilidade

- Facebook, 2021: [o relato da Meta](https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/) e [a visão de fora, pela Cloudflare](https://blog.cloudflare.com/october-2021-facebook-outage/)
- AWS, 2025: [resumo do evento do DynamoDB em us-east-1](https://aws.amazon.com/message/101925/)
- Cloudflare, 2025: [o incidente do 1.1.1.1 de 14 de julho](https://blog.cloudflare.com/cloudflare-1-1-1-1-incident-on-july-14-2025/)
- DENIC, 2026: [relatório final da queda do .de](https://blog.denic.de/en/final-report-dns-outage-of-5-may-2026/)
- Raiz: [DDoS de dezembro de 2025](https://root-servers.org/media/news/2025-12-23_DDoS.pdf) e [aumento de tráfego de junho de 2026](https://root-servers.org/media/news/2026-06-29-increase.pdf)
- [KeyTrap, CVE-2023-50387](https://kb.isc.org/docs/cve-2023-50387), [CVE-2025-40778](https://kb.isc.org/docs/cve-2025-40778) e a [matriz de segurança do BIND](https://kb.isc.org/docs/aa-00913)
- [Avisos de segurança do Unbound](https://www.nlnetlabs.nl/projects/unbound/security-advisories/)
- [Kaminsky, VU#800113](https://www.kb.cert.org/vuls/id/800113) e [SAD DNS](https://www.saddns.net/)

### Linux e Kubernetes

- [resolv.conf(5)](https://man7.org/linux/man-pages/man5/resolv.conf.5.html) e [resolved.conf(5)](https://www.freedesktop.org/software/systemd/man/latest/resolved.conf.html)
- [Diferenças funcionais entre musl e glibc](https://wiki.musl-libc.org/functional-differences-from-glibc.html)
- Kubernetes: [DNS para Services e Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) e [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)
- CoreDNS: plugins [kubernetes](https://coredns.io/plugins/kubernetes/) e [cache](https://coredns.io/plugins/cache/)
- APIs JSON de DoH usadas nos quadros: [Cloudflare](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/) e [Google](https://developers.google.com/speed/public-dns/docs/doh/json)

### Livros

- *DNS and BIND*, 5ª edição, de Cricket Liu e Paul Albitz (O'Reilly, 2006). Velho e ainda o melhor texto pra entender zona, delegação e resolução. A parte de DNSSEC envelheceu
- *DNSSEC Mastery*, 2ª edição, de Michael W Lucas (Tilted Windmill Press, 2022). Prático, curto e atual
- *Learning CoreDNS*, de John Belamaric e Cricket Liu (O'Reilly, 2019)
- *Managing Mission-Critical Domains and DNS*, de Mark E. Jeftovic (Packt, 2018). O lado de registrar, registry e operação que os outros livros pulam
- *DNS Security: Defending the Domain Name System*, de Allan Liska e Geoffrey Stowe (2016)
- [*Alternative DNS Servers*](https://jpmens.net/2010/10/29/alternative-dns-servers-the-book-as-pdf/), de Jan-Piet Mens. Antigo, e o PDF é gratuito
- [NIST SP 800-81r3, *Secure Domain Name System (DNS) Deployment Guide*](https://csrc.nist.gov/pubs/sp/800/81/r3/final), de março de 2026. Gratuito, e o guia de implantação mais atual que existe

### Artigos e palestras

- Paul Mockapetris e Kevin Dunlap, ["Development of the Domain Name System"](https://doi.org/10.1145/52324.52338), SIGCOMM 1988. Os autores contando o que deu certo e o que deu errado, cinco anos depois
- Bert Hubert, ["The DNS Camel"](https://blog.apnic.net/2018/03/29/the-dns-camel/), 2018. Sobre quanto peso o protocolo aguenta. Dele também é o [hello-dns](https://powerdns.org/hello-dns/), uma reescrita legível das RFCs básicas
- [RFC 8324](https://www.rfc-editor.org/info/rfc8324), de John Klensin: uma crítica ao que o DNS virou, escrita por quem estava lá
- Dan Kaminsky, ["Black Ops 2008: It's The End Of The Cache As We Know It"](https://blackhat.com/presentations/bh-jp-08/bh-jp-08-Kaminsky/BlackHat-Japan-08-Kaminsky-DNS08-BlackOps.pdf)
- Heftrig, Schulmann, Vogel e Waidner, ["The Harder You Try, The Harder You Fail"](https://arxiv.org/abs/2406.03133), o artigo do KeyTrap
- Castro, Wessels, Fomenkov e Claffy, ["A Day at the Root of the Internet"](https://catalog.caida.org/paper/2008_root_internet/), 2008
- Geoff Huston, [ISP Column](https://ispcol.potaroo.net/). O melhor acompanhamento contínuo de DNS que eu conheço. De 2026: ["Rolling the Root Key - What Happened?"](https://ispcol.potaroo.net/2026-10/kskroll2.html), ["The DO's and DOn'ts of Post-Quantum DNSSEC"](https://ispcol.potaroo.net/2026-11/dodnssec.html) e ["Centrality in the DNS"](https://ispcol.potaroo.net/2026-05/dns-centrality.html)
- ICANN, ["The Problem with 'The Seven Keys'"](https://www.icann.org/en/blogs/details/the-problem-with-the-seven-keys-13-2-2017-en) e a [lista de quem participa das cerimônias](https://www.iana.org/dnssec/tcrs)
- [Relatório de diversidade dos servidores raiz, 2026](https://root-servers.org/media/news/2026-External_Diversity_Report.pdf)
- [DNIB, Domain Name Industry Brief do terceiro trimestre de 2026](https://www.dnib.com/media/downloads/reports/domain-name-report-Q32026.pdf)

### Pra aprender

- Julia Evans: o zine [How DNS Works](https://wizardzines.com/zines/dns/), o [Implement DNS in a weekend](https://implement-dns.wizardzines.com/) (um resolvedor em Python, do zero) e o [Mess with DNS](https://messwithdns.net/), um domínio de verdade pra quebrar à vontade
- [How DNS Works](https://dnsimple.com/comics/how-dns-works/), o quadrinho da DNSimple
- [NsLookup.io, área de aprendizado](https://www.nslookup.io/learning/)
- [BIND 9 Administrator Reference Manual](https://bind9.readthedocs.io/en/stable/) e a [documentação do Unbound](https://unbound.docs.nlnetlabs.nl/en/latest/). Manual de servidor ensina mais protocolo do que parece
- Em português, do Registro.br: o [Tutorial DNSSEC](https://ftp.registro.br/pub/doc/tutorial-dnssec.pdf), a [Introdução a DNS e DNSSEC](https://ftp.registro.br/pub/doc/introducao-dns-dnssec.pdf) e o guia de [servidor recursivo com DNSSEC](https://ftp.registro.br/pub/doc/configuracao_dnssec_servidor_recursivo.pdf)
- Do NIC.br: as [recomendações pra não deixar recursivo aberto](https://bcp.nic.br/dns-recursivo) e os cursos da [Semana de Capacitação](https://semanacap.bcp.nic.br/)

### Ferramentas online

- [DNSViz](https://dnsviz.net/): desenha a cadeia de DNSSEC de um domínio e aponta onde quebra
- [Zonemaster](https://zonemaster.net/): testa a delegação e a zona
- [dnscheck.tools](https://dnscheck.tools/): mostra qual resolvedor você está usando de verdade, e se ele valida
- [intoDNS](https://intodns.com/) e [MXToolbox](https://mxtoolbox.com/): checagem rápida de zona e de e-mail
- [DNS-OARC](https://www.dns-oarc.net/): a comunidade de operadores, com as apresentações das reuniões
