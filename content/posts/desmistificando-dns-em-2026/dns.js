(function () {
  'use strict';

  var TIPOS = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 46: 'RRSIG', 47: 'NSEC', 48: 'DNSKEY', 50: 'NSEC3', 52: 'TLSA', 64: 'SVCB', 65: 'HTTPS', 257: 'CAA' };
  var NUMEROS = {};
  Object.keys(TIPOS).forEach(function (n) { NUMEROS[TIPOS[n]] = Number(n); });
  var RCODES = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
  var ALGORITMOS = { 5: 'RSASHA1', 7: 'RSASHA1-NSEC3', 8: 'RSASHA256', 10: 'RSASHA512', 13: 'ECDSAP256SHA256', 14: 'ECDSAP384SHA384', 15: 'ED25519', 16: 'ED448' };
  var ANCORAS_RAIZ = [20326, 38696];

  var RESOLVEDORES = {
    cloudflare: {
      nome: 'Cloudflare (1.1.1.1)',
      url: function (q) { return 'https://cloudflare-dns.com/dns-query?' + q; },
      opcoes: { headers: { accept: 'application/dns-json' } }
    },
    google: {
      nome: 'Google (8.8.8.8)',
      url: function (q) { return 'https://dns.google/resolve?' + q; },
      opcoes: {}
    }
  };

  function semPonto(nome) {
    return nome === '.' ? '.' : String(nome || '').replace(/\.$/, '') || '.';
  }

  function normaliza(json, ms, id) {
    var limpa = function (lista) {
      return (lista || []).map(function (r) {
        return { name: semPonto(r.name), type: r.type, TTL: r.TTL, data: r.data };
      });
    };
    var comentario = json.Comment || [];
    if (typeof comentario === 'string') comentario = [comentario];
    return {
      Status: json.Status, TC: json.TC, RD: json.RD, RA: json.RA, AD: json.AD, CD: json.CD,
      Answer: limpa(json.Answer), Authority: limpa(json.Authority),
      Comment: comentario, ms: ms, resolvedor: id
    };
  }

  // Consulta por DNS sobre HTTPS, no formato JSON que Cloudflare e Google
  // expõem. Se o resolvedor pedido não responder, tenta o outro uma vez.
  function doh(nome, tipo, opcoes) {
    opcoes = opcoes || {};
    var ordem = [opcoes.resolvedor || 'cloudflare'];
    if (!opcoes.semReserva) ordem.push(ordem[0] === 'cloudflare' ? 'google' : 'cloudflare');
    var q = 'name=' + encodeURIComponent(nome) + '&type=' + encodeURIComponent(tipo);
    if (opcoes.dnssec) q += '&do=1';
    if (opcoes.cd) q += '&cd=1';

    function tenta(i) {
      var r = RESOLVEDORES[ordem[i]];
      var inicio = performance.now();
      return fetch(r.url(q), r.opcoes).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (json) {
        return normaliza(json, Math.round(performance.now() - inicio), ordem[i]);
      }).catch(function (erro) {
        if (i + 1 < ordem.length) return tenta(i + 1);
        throw erro;
      });
    }
    return tenta(0);
  }

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (filhos || []).forEach(function (f) {
      if (f == null) return;
      e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return e;
  }

  function svg(tag, attrs, filhos) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { e.appendChild(f); });
    return e;
  }

  function campo(rotulo, controle) {
    return el('label', { class: 'dnslab-campo' }, [el('span', { text: rotulo }), controle]);
  }

  function escolha(opcoes, atual) {
    return el('select', {}, opcoes.map(function (o) {
      var valor = Array.isArray(o) ? o[0] : o;
      var texto = Array.isArray(o) ? o[1] : o;
      return el('option', { value: valor, text: texto, selected: valor === atual });
    }));
  }

  // Nome digitado -> forma ASCII (A-label). O parser de URL do navegador já
  // faz a conversão de IDN pra punycode.
  function paraAscii(texto) {
    var nome = String(texto || '').trim().replace(/^\w+:\/\//, '').replace(/[\/?#].*$/, '');
    if (nome === '' || nome === '.') return '.';
    var absoluto = /\.$/.test(nome);
    nome = nome.replace(/\.$/, '');
    try {
      if (/[^\x00-\x7f]/.test(nome)) nome = new URL('http://' + nome).hostname;
    } catch (e) { /* fica como foi digitado e a validação reclama */ }
    return nome.toLowerCase() + (absoluto ? '.' : '');
  }

  function rotulos(nome) {
    nome = semPonto(nome);
    return nome === '.' ? [] : nome.split('.');
  }

  function valida(nome) {
    var partes = rotulos(nome);
    var total = 1;
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].length === 0) return 'Tem um rótulo vazio (dois pontos seguidos).';
      if (partes[i].length > 63) return 'O rótulo "' + partes[i].slice(0, 20) + '…" tem ' + partes[i].length + ' bytes. O limite é 63.';
      if (/[^\x21-\x7e]/.test(partes[i])) return 'Tem caractere que não dá pra converter em ASCII.';
      total += partes[i].length + 1;
    }
    if (total > 255) return 'O nome ocupa ' + total + ' bytes no fio. O limite é 255.';
    return '';
  }

  function sufixos(nome) {
    var partes = rotulos(nome);
    var lista = ['.'];
    for (var i = partes.length - 1; i >= 0; i--) lista.push(partes.slice(i).join('.'));
    return lista;
  }

  function erroDeRede(caixa) {
    caixa.appendChild(el('p', { class: 'dnslab-erro', text: 'Não consegui falar com nenhum resolvedor DoH. Bloqueador de anúncio, proxy corporativo ou rede sem acesso a cloudflare-dns.com e dns.google costumam ser a causa.' }));
  }

  var LABS = {};

  // ---------------------------------------------------------------- nome
  LABS.nome = function (raiz) {
    var entrada = el('input', { type: 'text', value: 'www.leandrosf.com', spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Nome de domínio' });
    var saida = el('div', { class: 'dnslab-saida' });
    var niveis = ['raiz', 'TLD', '2º nível', '3º nível', '4º nível', '5º nível'];

    function desenha() {
      saida.textContent = '';
      var nome = paraAscii(entrada.value);
      var erro = valida(nome);
      if (erro) { saida.appendChild(el('p', { class: 'dnslab-erro', text: erro })); return; }
      var partes = rotulos(nome);
      var linha = el('div', { class: 'dnslab-rotulos' });
      partes.forEach(function (p, i) {
        var nivel = partes.length - i;
        linha.appendChild(el('div', { class: 'dnslab-rotulo nivel-' + Math.min(nivel, 4) }, [
          el('code', { text: p }),
          el('small', { text: (niveis[nivel] || nivel + 'º nível') + ' · ' + p.length + (p.length === 1 ? ' byte' : ' bytes') })
        ]));
        linha.appendChild(el('span', { class: 'dnslab-ponto', text: '.' }));
      });
      linha.appendChild(el('div', { class: 'dnslab-rotulo nivel-0' }, [el('code', { text: '""' }), el('small', { text: 'raiz · 0 bytes' })]));
      saida.appendChild(linha);
      var fio = partes.reduce(function (s, p) { return s + p.length + 1; }, 1);
      var texto = 'FQDN: ' + (partes.join('.') || '') + '. · ' + partes.length + (partes.length === 1 ? ' rótulo' : ' rótulos') + ' · ' + fio + ' de 255 bytes no fio';
      saida.appendChild(el('p', { class: 'dnslab-nota', text: texto }));
      if (/(^|\.)xn--/.test(nome)) {
        saida.appendChild(el('p', { class: 'dnslab-nota', text: 'Rótulo com xn-- é punycode: o DNS só carrega ASCII, e o navegador converte o nome com acento antes de perguntar.' }));
      }
      saida.appendChild(el('p', { class: 'dnslab-nota', text: 'A resolução anda da direita pra esquerda: ' + sufixos(nome).map(function (s) { return s === '.' ? 'raiz' : s; }).join(' → ') + '.' }));
    }
    entrada.addEventListener('input', desenha);
    raiz.appendChild(campo('Nome', entrada));
    raiz.appendChild(saida);
    desenha();
  };

  // ------------------------------------------------------------- pacote
  LABS.pacote = function (raiz) {
    var entrada = el('input', { type: 'text', value: 'www.leandrosf.com', spellcheck: 'false', autocapitalize: 'off' });
    var tipo = escolha(['A', 'AAAA', 'NS', 'MX', 'TXT', 'SOA', 'CNAME', 'HTTPS', 'DNSKEY', 'DS'], 'A');
    var rd = el('input', { type: 'checkbox', checked: true });
    var edns = el('input', { type: 'checkbox', checked: true });
    var dnssecOk = el('input', { type: 'checkbox' });
    var hex = el('div', { class: 'dnslab-hex', role: 'list' });
    var explica = el('div', { class: 'dnslab-explica', 'aria-live': 'polite' });
    var resumo = el('p', { class: 'dnslab-nota' });
    var id = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];

    function monta() {
      var nome = paraAscii(entrada.value);
      var erro = valida(nome);
      hex.textContent = '';
      explica.textContent = '';
      if (erro) { resumo.className = 'dnslab-erro'; resumo.textContent = erro; return; }
      resumo.className = 'dnslab-nota';
      var campos = [];
      var flags = rd.checked ? 0x0100 : 0;
      campos.push({ c: 'id', b: id, t: 'ID', d: 'Número de 16 bits sorteado pelo cliente. A resposta precisa trazer o mesmo, e junto com a porta de origem é o que dificulta forjar uma resposta.' });
      campos.push({ c: 'flags', b: [flags >> 8, flags & 255], t: 'Flags', d: 'QR=0 (é pergunta), OPCODE=0 (QUERY), ' + (rd.checked ? 'RD=1: peço que o servidor faça a recursão por mim.' : 'RD=0: não quero recursão, só o que o servidor sabe. É assim que um recursivo fala com um autoritativo.') });
      campos.push({ c: 'cont', b: [0, 1], t: 'QDCOUNT', d: 'Uma pergunta. Na prática é sempre uma (a RFC 9619 formalizou isso).' });
      campos.push({ c: 'cont', b: [0, 0], t: 'ANCOUNT', d: 'Zero respostas: isto é uma pergunta.' });
      campos.push({ c: 'cont', b: [0, 0], t: 'NSCOUNT', d: 'Zero registros na seção de autoridade.' });
      campos.push({ c: 'cont', b: [0, edns.checked ? 1 : 0], t: 'ARCOUNT', d: edns.checked ? 'Um registro na seção adicional: o pseudo-registro OPT do EDNS, lá no fim.' : 'Nada na seção adicional. Sem EDNS, a resposta por UDP fica limitada a 512 bytes.' });
      rotulos(nome).forEach(function (r) {
        campos.push({ c: 'len', b: [r.length], t: 'Tamanho do rótulo', d: 'O rótulo seguinte tem ' + r.length + (r.length === 1 ? ' byte' : ' bytes') + '. Os dois bits de cima ficam livres pra marcar ponteiro de compressão, por isso o limite de 63.' });
        campos.push({ c: 'nome', b: r.split('').map(function (ch) { return ch.charCodeAt(0); }), t: 'Rótulo "' + r + '"', d: 'Os bytes do rótulo, em ASCII. Não tem ponto no fio: o ponto que você digita vira o byte de tamanho.' });
      });
      campos.push({ c: 'len', b: [0], t: 'Fim do nome', d: 'Rótulo de tamanho zero: a raiz. Todo nome no fio termina nela.' });
      var n = NUMEROS[tipo.value];
      campos.push({ c: 'tipo', b: [n >> 8, n & 255], t: 'QTYPE = ' + tipo.value, d: 'O tipo de registro pedido. ' + tipo.value + ' é o número ' + n + '.' });
      campos.push({ c: 'tipo', b: [0, 1], t: 'QCLASS = IN', d: 'Classe Internet. Existem CHAOS (3) e HESIOD (4), que hoje servem pra curiosidade e pra perguntar a versão do servidor.' });
      if (edns.checked) {
        campos.push({ c: 'opt', b: [0], t: 'OPT: nome', d: 'O pseudo-registro OPT (RFC 6891) tem nome vazio, a raiz.' });
        campos.push({ c: 'opt', b: [0, 41], t: 'OPT: tipo 41', d: 'Tipo OPT. Não é dado de zona, é sinalização entre cliente e servidor.' });
        campos.push({ c: 'opt', b: [0x04, 0xd0], t: 'OPT: tamanho UDP', d: 'No lugar da classe vai o maior datagrama UDP que eu aceito: 1232 bytes, o valor recomendado desde o DNS Flag Day de 2020.' });
        campos.push({ c: 'opt', b: [0, 0, dnssecOk.checked ? 0x80 : 0, 0], t: 'OPT: RCODE estendido, versão e flags', d: 'No lugar do TTL: 8 bits de RCODE estendido, a versão do EDNS (0) e 16 bits de flags. ' + (dnssecOk.checked ? 'O bit DO está ligado: quero os RRSIG na resposta.' : 'O bit DO está desligado: não mande assinaturas.') });
        campos.push({ c: 'opt', b: [0, 0], t: 'OPT: RDLENGTH', d: 'Zero opções. É aqui que entrariam cookie, client subnet, padding e NSID.' });
      }
      var total = 0;
      campos.forEach(function (c) {
        total += c.b.length;
        var grupo = el('span', { class: 'dnslab-bytes cor-' + c.c, tabindex: '0', role: 'listitem', 'aria-label': c.t }, c.b.map(function (b) {
          return el('span', { text: (b < 16 ? '0' : '') + b.toString(16) });
        }));
        var mostra = function () {
          explica.textContent = '';
          explica.appendChild(el('strong', { text: c.t }));
          explica.appendChild(el('span', { text: ' ' + c.d }));
          Array.prototype.forEach.call(hex.children, function (g) { g.classList.remove('ativo'); });
          grupo.classList.add('ativo');
        };
        grupo.addEventListener('mouseenter', mostra);
        grupo.addEventListener('focus', mostra);
        grupo.addEventListener('click', mostra);
        hex.appendChild(grupo);
      });
      resumo.textContent = 'Pergunta inteira: ' + total + ' bytes. Passe o mouse (ou toque) em cada grupo pra ver o que ele é.';
    }
    [entrada, tipo, rd, edns, dnssecOk].forEach(function (c) { c.addEventListener('input', monta); });
    raiz.appendChild(el('div', { class: 'dnslab-form' }, [
      campo('Nome', entrada), campo('Tipo', tipo),
      el('label', { class: 'dnslab-marca' }, [rd, ' RD (recursão)']),
      el('label', { class: 'dnslab-marca' }, [edns, ' EDNS']),
      el('label', { class: 'dnslab-marca' }, [dnssecOk, ' DO (DNSSEC)'])
    ]));
    raiz.appendChild(resumo);
    raiz.appendChild(hex);
    raiz.appendChild(explica);
    monta();
  };

  // ---------------------------------------------------------------- dig
  function linhaRR(r) {
    return el('div', { class: 'dnslab-rr' }, [
      el('span', { class: 'rr-nome', text: (r.name === '.' ? '' : r.name) + '.' }),
      el('span', { class: 'rr-ttl', text: String(r.TTL) }),
      el('span', { class: 'rr-tipo', text: TIPOS[r.type] || 'TYPE' + r.type }),
      el('span', { class: 'rr-dado', text: r.data })
    ]);
  }

  LABS.dig = function (raiz) {
    var entrada = el('input', { type: 'text', value: raiz.dataset.nome || 'www.leandrosf.com', spellcheck: 'false', autocapitalize: 'off' });
    var tipo = escolha(['A', 'AAAA', 'NS', 'MX', 'TXT', 'SOA', 'CNAME', 'CAA', 'HTTPS', 'DS', 'DNSKEY', 'PTR', 'SRV'], raiz.dataset.tipo || 'A');
    var quem = escolha([['cloudflare', 'Cloudflare'], ['google', 'Google']], 'cloudflare');
    var dnssecOk = el('input', { type: 'checkbox' });
    var botao = el('button', { type: 'submit', text: 'Consultar' });
    var saida = el('div', { class: 'dnslab-term', 'aria-live': 'polite' });
    var form = el('form', { class: 'dnslab-form' }, [
      campo('Nome', entrada), campo('Tipo', tipo), campo('Resolvedor', quem),
      el('label', { class: 'dnslab-marca' }, [dnssecOk, ' +dnssec']), botao
    ]);

    function consulta(ev) {
      if (ev) ev.preventDefault();
      var nome = paraAscii(entrada.value);
      saida.textContent = '';
      var erro = valida(nome);
      if (erro) { saida.appendChild(el('p', { class: 'dnslab-erro', text: erro })); return; }
      botao.disabled = true;
      doh(nome, tipo.value, { resolvedor: quem.value, dnssec: dnssecOk.checked, semReserva: true }).then(function (r) {
        var flags = ['qr'];
        if (r.RD) flags.push('rd');
        if (r.RA) flags.push('ra');
        if (r.AD) flags.push('ad');
        if (r.CD) flags.push('cd');
        if (r.TC) flags.push('tc');
        saida.appendChild(el('div', { class: 'dnslab-cab' }, [
          'status: ', el('b', { class: r.Status === 0 ? 'ok' : 'ruim', text: RCODES[r.Status] || 'RCODE ' + r.Status }),
          ' · flags: ' + flags.join(' ') + ' · ' + r.ms + ' ms · ' + RESOLVEDORES[r.resolvedor].nome
        ]));
        if (r.Answer.length) {
          saida.appendChild(el('div', { class: 'dnslab-secao', text: ';; ANSWER' }));
          r.Answer.forEach(function (rr) { saida.appendChild(linhaRR(rr)); });
        }
        if (r.Authority.length) {
          saida.appendChild(el('div', { class: 'dnslab-secao', text: ';; AUTHORITY' }));
          r.Authority.forEach(function (rr) { saida.appendChild(linhaRR(rr)); });
        }
        r.Comment.forEach(function (c) {
          if (/^Response from/.test(c)) return;
          saida.appendChild(el('div', { class: 'dnslab-secao', text: ';; ' + c }));
        });
        var nota = '';
        if (r.Status === 3) nota = 'NXDOMAIN: o nome não existe. O SOA em AUTHORITY diz por quanto tempo o resolvedor pode guardar esse "não existe": o menor entre o TTL do SOA e o último campo dele.';
        else if (r.Status === 2) nota = 'SERVFAIL: o resolvedor não conseguiu uma resposta em que confie. Quando é falha de DNSSEC, o motivo vem no Extended DNS Error (EDE) acima.';
        else if (r.Status === 0 && !r.Answer.length) nota = 'NOERROR sem resposta (NODATA): o nome existe, mas não tem registro desse tipo.';
        else if (r.AD) nota = 'A flag ad diz que o resolvedor validou a resposta com DNSSEC. Consulte de novo e veja o TTL descendo: é o cache dele contando.';
        else nota = 'Sem a flag ad: a zona não é assinada ou a cadeia não fecha até a raiz. Consulte de novo e veja o TTL descendo: é o cache do resolvedor contando.';
        saida.appendChild(el('p', { class: 'dnslab-nota', text: nota }));
      }).catch(function () { erroDeRede(saida); }).then(function () { botao.disabled = false; });
    }
    form.addEventListener('submit', consulta);
    raiz.appendChild(form);
    raiz.appendChild(saida);
  };

  // -------------------------------------------------------------- trace
  function soDoTipo(lista, tipo, nome) {
    return lista.filter(function (r) { return r.type === tipo && (nome == null || r.name.toLowerCase() === nome.toLowerCase()); });
  }

  // Descobre onde estão os cortes de zona perguntando o NS de cada sufixo.
  function cortes(nome) {
    return Promise.all(sufixos(nome).map(function (s) {
      return doh(s, 'NS').then(function (r) {
        return { zona: s, ns: soDoTipo(r.Answer, 2, s), resposta: r };
      });
    }));
  }

  LABS.trace = function (raiz) {
    var entrada = el('input', { type: 'text', value: 'www.leandrosf.com', spellcheck: 'false', autocapitalize: 'off' });
    var botao = el('button', { type: 'submit', text: 'Seguir a delegação' });
    var saida = el('ol', { class: 'dnslab-passos', 'aria-live': 'polite' });
    var form = el('form', { class: 'dnslab-form' }, [campo('Nome', entrada), botao]);

    function passo(titulo, corpo, classe) {
      var li = el('li', { class: 'dnslab-passo ' + (classe || '') }, [el('strong', { text: titulo })]);
      (corpo || []).forEach(function (c) { li.appendChild(typeof c === 'string' ? el('span', { text: c }) : c); });
      saida.appendChild(li);
      return li;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = semPonto(paraAscii(entrada.value));
      saida.textContent = '';
      var erro = valida(nome);
      if (erro || nome === '.') { saida.appendChild(el('li', { class: 'dnslab-erro', text: erro || 'Digite um nome.' })); return; }
      botao.disabled = true;
      Promise.all([cortes(nome), doh(nome, 'A'), doh(nome, 'AAAA')]).then(function (tudo) {
        var zonaAtual = '.';
        tudo[0].forEach(function (c, i) {
          var rotulo = c.zona === '.' ? 'raiz (.)' : c.zona;
          if (c.ns.length) {
            zonaAtual = c.zona;
            var nomes = c.ns.map(function (r) { return semPonto(r.data); }).sort();
            var mostra = nomes.slice(0, 4).join(', ') + (nomes.length > 4 ? ' e mais ' + (nomes.length - 4) : '');
            passo(rotulo, [
              (i === 0 ? 'O ponto de partida. ' : 'Zona delegada. ') + nomes.length + (nomes.length === 1 ? ' servidor: ' : ' servidores: '),
              el('code', { text: mostra }),
              ' · TTL ' + c.ns[0].TTL + ' s'
            ], 'corte');
          } else if (c.resposta.Status === 3) {
            passo(rotulo, ['Não existe (NXDOMAIN). Quem diz isso é a zona ' + (zonaAtual === '.' ? 'raiz' : zonaAtual) + '.'], 'falha');
          } else {
            passo(rotulo, ['Não é uma zona separada: não tem NS próprio. Quem responde por esse nome é ' + (zonaAtual === '.' ? 'a raiz' : zonaAtual) + '.'], 'folha');
          }
        });
        var respostas = tudo[1].Answer.concat(soDoTipo(tudo[2].Answer, 28));
        if (respostas.length) {
          var li = passo('Resposta final', ['Vinda dos servidores de ' + (zonaAtual === '.' ? 'raiz' : zonaAtual) + ':'], 'final');
          respostas.forEach(function (r) { li.appendChild(linhaRR(r)); });
        } else {
          passo('Resposta final', [(RCODES[tudo[1].Status] || 'erro') + ': nenhum A ou AAAA pra esse nome.'], 'falha');
        }
        saida.appendChild(el('li', { class: 'dnslab-nota', text: 'Isso foi montado com consultas a um recursivo público, que já tinha quase tudo em cache. Um recursivo com cache frio faz o mesmo caminho perguntando direto a cada um desses servidores.' }));
      }).catch(function () { erroDeRede(saida); }).then(function () { botao.disabled = false; });
    });
    raiz.appendChild(form);
    raiz.appendChild(saida);
  };

  // ------------------------------------------------------------- dnssec
  function base64ParaBytes(b64) {
    var bin = atob(b64.replace(/\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Key tag da RFC 4034, apêndice B: uma soma de verificação sobre o RDATA
  // do DNSKEY (flags, protocolo, algoritmo e a chave pública).
  function keyTag(flags, protocolo, algoritmo, chaveB64) {
    var chave = base64ParaBytes(chaveB64);
    var rdata = new Uint8Array(4 + chave.length);
    rdata[0] = flags >> 8; rdata[1] = flags & 255; rdata[2] = protocolo; rdata[3] = algoritmo;
    rdata.set(chave, 4);
    var soma = 0;
    for (var i = 0; i < rdata.length; i++) soma += (i & 1) ? rdata[i] : rdata[i] << 8;
    soma += (soma >> 16) & 0xffff;
    return soma & 0xffff;
  }

  function chavesDe(resposta) {
    return soDoTipo(resposta.Answer, 48).map(function (r) {
      var p = r.data.split(/\s+/);
      var flags = Number(p[0]), alg = Number(p[2]);
      return { flags: flags, alg: alg, tag: keyTag(flags, Number(p[1]), alg, p.slice(3).join('')), ksk: flags === 257 };
    });
  }

  function dsDe(resposta) {
    return soDoTipo(resposta.Answer, 43).map(function (r) {
      var p = r.data.split(/\s+/);
      return { tag: Number(p[0]), alg: Number(p[1]), digest: Number(p[2]) };
    });
  }

  LABS.dnssec = function (raiz) {
    var entrada = el('input', { type: 'text', value: 'registro.br', spellcheck: 'false', autocapitalize: 'off' });
    var botao = el('button', { type: 'submit', text: 'Montar a cadeia' });
    var saida = el('div', { class: 'dnslab-cadeia', 'aria-live': 'polite' });
    var exemplos = el('div', { class: 'dnslab-exemplos' }, ['Tente: '].concat(['registro.br', 'leandrosf.com', 'cloudflare.com', 'dnssec-failed.org'].map(function (n) {
      return el('button', { type: 'button', class: 'dnslab-link', text: n, onclick: function () { entrada.value = n; form.requestSubmit(); } });
    })));
    var form = el('form', { class: 'dnslab-form' }, [campo('Domínio', entrada), botao]);

    function algo(n) { return (ALGORITMOS[n] || 'algoritmo') + ' (' + n + ')'; }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = semPonto(paraAscii(entrada.value));
      saida.textContent = '';
      var erro = valida(nome);
      if (erro || nome === '.') { saida.appendChild(el('p', { class: 'dnslab-erro', text: erro || 'Digite um domínio.' })); return; }
      botao.disabled = true;
      cortes(nome).then(function (lista) {
        var zonas = lista.filter(function (c) { return c.ns.length; }).map(function (c) { return c.zona; });
        return Promise.all(zonas.map(function (z) {
          return Promise.all([
            doh(z, 'DNSKEY', { cd: true }),
            z === '.' ? Promise.resolve(null) : doh(z, 'DS', { cd: true })
          ]).then(function (r) {
            return { zona: z, chaves: chavesDe(r[0]), ds: r[1] ? dsDe(r[1]) : null };
          });
        })).then(function (porZona) {
          return doh(nome, 'A', { dnssec: true, semReserva: false }).then(function (final) {
            return { zonas: porZona, final: final };
          });
        });
      }).then(function (r) {
        var segura = true;
        r.zonas.forEach(function (z, i) {
          var ksk = z.chaves.filter(function (c) { return c.ksk; });
          var zsk = z.chaves.filter(function (c) { return !c.ksk; });
          var estado, texto;
          if (z.zona === '.') {
            var presentes = ksk.filter(function (c) { return ANCORAS_RAIZ.indexOf(c.tag) >= 0; }).map(function (c) { return c.tag; });
            estado = 'ok';
            texto = 'Âncora de confiança: não tem DS acima da raiz. O validador já traz a KSK configurada. Na zona hoje: ' + (presentes.join(' e ') || 'nenhuma das conhecidas') + '.';
          } else if (!segura) {
            estado = 'neutro';
            texto = 'Abaixo de uma zona sem assinatura, nada aqui é validado, mesmo que a zona publique chaves.';
          } else if (!z.ds.length) {
            estado = 'aviso'; segura = false;
            texto = 'Sem DS na zona de cima: a cadeia termina aqui. Daqui pra baixo o resolvedor responde sem validar (zona insegura, não quebrada).';
          } else {
            var casa = z.ds.filter(function (d) { return ksk.some(function (c) { return c.tag === d.tag; }); });
            if (casa.length) {
              estado = 'ok';
              texto = 'DS ' + casa.map(function (d) { return d.tag; }).join(', ') + ' na zona de cima aponta pra KSK de mesmo key tag, ' + algo(casa[0].alg) + '.';
            } else {
              estado = 'falha'; segura = false;
              texto = 'Tem DS (' + z.ds.map(function (d) { return d.tag; }).join(', ') + ') na zona de cima, mas nenhuma KSK publicada bate com ele. Pra um validador isso é bogus, e a resposta vira SERVFAIL.';
            }
          }
          var cartao = el('div', { class: 'dnslab-elo ' + estado }, [
            el('div', { class: 'elo-zona' }, [el('code', { text: z.zona === '.' ? '. (raiz)' : z.zona })]),
            el('p', { text: texto })
          ]);
          if (z.chaves.length) {
            cartao.appendChild(el('p', { class: 'elo-chaves', text: 'DNSKEY: ' + [
              ksk.length ? 'KSK ' + ksk.map(function (c) { return c.tag; }).join(', ') : '',
              zsk.length ? 'ZSK ' + zsk.map(function (c) { return c.tag; }).join(', ') : ''
            ].filter(Boolean).join(' · ') + ' · ' + algo(z.chaves[0].alg) }));
          } else {
            cartao.appendChild(el('p', { class: 'elo-chaves', text: 'Nenhum DNSKEY publicado.' }));
          }
          if (i > 0) saida.appendChild(el('div', { class: 'dnslab-seta', text: '↓' }));
          saida.appendChild(cartao);
        });
        var f = r.final;
        var veredito;
        if (f.Status === 2) veredito = ['falha', 'O resolvedor devolveu SERVFAIL pra ' + nome + '. ' + (f.Comment.join(' ') || '')];
        else if (f.AD) veredito = ['ok', 'O resolvedor validou ' + nome + ': a resposta veio com a flag AD.'];
        else veredito = ['aviso', 'A resposta de ' + nome + ' veio sem a flag AD: o resolvedor entregou, mas não tinha como validar.'];
        saida.appendChild(el('p', { class: 'dnslab-veredito ' + veredito[0], text: veredito[1] }));
      }).catch(function () { erroDeRede(saida); }).then(function () { botao.disabled = false; });
    });
    raiz.appendChild(form);
    raiz.appendChild(exemplos);
    raiz.appendChild(saida);
  };

  // ---------------------------------------------------------------- ttl
  LABS.ttl = function (raiz) {
    var ttl = escolha([['60', '60 s'], ['300', '5 min'], ['3600', '1 h'], ['86400', '24 h']], '3600');
    var botao = el('button', { type: 'button', text: 'Trocar o IP agora' });
    var relogio = el('div', { class: 'dnslab-relogio' });
    var grade = el('div', { class: 'dnslab-caches' });
    var nota = el('p', { class: 'dnslab-nota' });
    var total = 12, quadro = null;
    var nomes = ['Provedor A', 'Provedor B', 'Provedor C', '1.1.1.1 GRU', '1.1.1.1 MIA', '8.8.8.8', '9.9.9.9', 'Empresa X', 'Wi-Fi de casa', 'Operadora 4G', 'Universidade', 'Datacenter'];

    function formata(s) {
      if (s < 120) return Math.round(s) + ' s';
      if (s < 7200) return Math.round(s / 60) + ' min';
      return (s / 3600).toFixed(1).replace('.', ',') + ' h';
    }

    function prepara() {
      if (quadro) cancelAnimationFrame(quadro);
      grade.textContent = '';
      relogio.textContent = 'Todo mundo com o IP antigo em cache.';
      nota.textContent = 'Cada resolvedor guardou a resposta num momento diferente, então cada um tem um tempo diferente pra expirar.';
      var T = Number(ttl.value);
      var caches = nomes.slice(0, total).map(function (n, i) {
        var resta = T * (0.04 + 0.96 * ((i * 7 + 3) % total) / (total - 1));
        var barra = el('i');
        var linha = el('div', { class: 'dnslab-cache' }, [
          el('span', { class: 'cache-nome', text: n }),
          el('span', { class: 'cache-barra' }, [barra]),
          el('span', { class: 'cache-ip', text: '203.0.113.10' })
        ]);
        grade.appendChild(linha);
        return { resta: resta, linha: linha, barra: barra, ip: linha.lastChild };
      });
      caches.forEach(function (c) { c.barra.style.width = (100 * c.resta / T) + '%'; });
      return { T: T, caches: caches };
    }

    var estado = prepara();
    ttl.addEventListener('input', function () { estado = prepara(); });
    botao.addEventListener('click', function () {
      estado = prepara();
      var T = estado.T, inicio = performance.now(), duracao = 9000;
      var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function pinta(t) {
        var novos = 0;
        estado.caches.forEach(function (c) {
          var sobra = c.resta - t;
          if (sobra <= 0) {
            novos++;
            c.linha.classList.add('novo');
            c.ip.textContent = '198.51.100.20';
            c.barra.style.width = (100 * (1 - ((-sobra) % T) / T)) + '%';
          } else {
            c.barra.style.width = (100 * sobra / T) + '%';
          }
        });
        relogio.textContent = 'Passaram ' + formata(t) + ' desde a troca · ' + novos + ' de ' + total + ' já veem o IP novo';
        return novos;
      }
      function fim() {
        nota.textContent = 'Ninguém avisou os caches de nada. Cada um só buscou o registro de novo quando o TTL que ele tinha venceu. O pior caso é um TTL inteiro (' + formata(T) + '), a média é metade disso. Por isso se baixa o TTL antes de uma migração, não depois.';
      }
      if (semMovimento) { pinta(T); fim(); return; }
      function tique(agora) {
        var t = Math.min(1, (agora - inicio) / duracao) * T;
        pinta(t);
        if (t < T) quadro = requestAnimationFrame(tique); else fim();
      }
      quadro = requestAnimationFrame(tique);
    });
    raiz.appendChild(el('div', { class: 'dnslab-form' }, [campo('TTL do registro', ttl), botao]));
    raiz.appendChild(relogio);
    raiz.appendChild(grade);
    raiz.appendChild(nota);
  };

  // ---------------------------------------------------------- resolucao
  LABS.resolucao = function (raiz) {
    var nos = {
      stub: { x: 70, y: 250, t: 'Seu computador', s: 'stub resolver' },
      rec: { x: 300, y: 250, t: 'Recursivo', s: '1.1.1.1, o do provedor…' },
      root: { x: 560, y: 60, t: 'Raiz', s: 'a–m.root-servers.net' },
      tld: { x: 560, y: 250, t: '.com', s: 'gtld-servers.net' },
      auth: { x: 560, y: 440, t: 'leandrosf.com', s: 'ns.cloudflare.com' }
    };
    var passos = [
      { de: 'stub', para: 'rec', p: 'www.leandrosf.com. A?', d: 'O stub resolver do sistema não sabe resolver nada sozinho. Ele manda a pergunta com RD=1 pro recursivo configurado e espera.' },
      { de: 'rec', para: 'root', p: 'com. NS?', d: 'Cache frio: o recursivo começa pela raiz, cujos endereços ele traz de fábrica. Com QNAME minimisation ele pergunta só o que a raiz precisa saber.' },
      { de: 'root', para: 'rec', p: 'pergunte a a.gtld-servers.net…', d: 'A raiz não sabe o IP de ninguém. Ela devolve um referral: os 13 NS de .com, com TTL de 172800 s, e os endereços deles como glue.', volta: true },
      { de: 'rec', para: 'tld', p: 'leandrosf.com. NS?', d: 'Agora ele pergunta a um servidor de .com.' },
      { de: 'tld', para: 'rec', p: 'pergunte a dawn.ns.cloudflare.com…', d: 'Outro referral: leandrosf.com está delegado pra dawn e jake.ns.cloudflare.com, também por 172800 s.', volta: true },
      { de: 'rec', para: 'auth', p: 'www.leandrosf.com. A?', d: 'Só aqui o nome completo aparece: o autoritativo da zona é quem tem o dado.' },
      { de: 'auth', para: 'rec', p: '172.67.200.25, 104.21.21.202', d: 'Resposta com AA=1 (autoritativa) e TTL de 300 s. O recursivo guarda no cache tudo o que aprendeu no caminho.', volta: true },
      { de: 'rec', para: 'stub', p: '172.67.200.25, 104.21.21.202', d: 'O stub recebe a resposta pronta. Foram quatro idas e voltas, tipicamente dezenas de milissegundos.', volta: true }
    ];
    var quente = [0, 7];
    var W = 680, H = 500;
    var tela = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'dnslab-svg', role: 'img', 'aria-label': 'Animação da resolução recursiva de www.leandrosf.com' });
    var defs = svg('defs', {}, [svg('marker', { id: 'dnslab-ponta', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, [svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'ponta' })])]);
    tela.appendChild(defs);
    var arestas = {};
    [['stub', 'rec'], ['rec', 'root'], ['rec', 'tld'], ['rec', 'auth']].forEach(function (par) {
      var a = nos[par[0]], b = nos[par[1]];
      var linha = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'aresta' });
      arestas[par.join('-')] = linha;
      tela.appendChild(linha);
    });
    Object.keys(nos).forEach(function (k) {
      var n = nos[k];
      var g = svg('g', { class: 'no no-' + k, transform: 'translate(' + n.x + ',' + n.y + ')' }, [
        svg('rect', { x: -62, y: -28, width: 124, height: 56, rx: 10 }),
        svg('text', { y: -4, class: 'no-titulo', text: n.t }),
        svg('text', { y: 14, class: 'no-sub', text: n.s })
      ]);
      n.g = g;
      tela.appendChild(g);
    });
    var bolha = svg('g', { class: 'pacote', style: 'display:none' }, [
      svg('rect', { x: -6, y: -13, width: 12, height: 26, rx: 13 }),
      svg('text', { y: 4, text: '' })
    ]);
    tela.appendChild(bolha);
    var legenda = el('div', { class: 'dnslab-legenda', 'aria-live': 'polite' });
    var cache = el('input', { type: 'checkbox' });
    var bAnt = el('button', { type: 'button', text: '◀' , 'aria-label': 'Passo anterior' });
    var bToca = el('button', { type: 'button', text: '▶ Tocar' });
    var bProx = el('button', { type: 'button', text: '▶▏', 'aria-label': 'Próximo passo' });
    var atual = -1, tocando = false, quadro = null, espera = null;

    function lista() { return cache.checked ? quente : passos.map(function (_, i) { return i; }); }

    function mostra(i, animar) {
      var seq = lista();
      atual = i;
      Object.keys(nos).forEach(function (k) { nos[k].g.classList.remove('ativo'); });
      Object.keys(arestas).forEach(function (k) { arestas[k].classList.remove('ativa'); });
      if (i < 0 || i >= seq.length) {
        bolha.style.display = 'none';
        legenda.textContent = '';
        legenda.appendChild(el('strong', { text: cache.checked ? 'Cache quente. ' : 'Cache frio. ' }));
        legenda.appendChild(document.createTextNode(cache.checked ? 'Alguém já perguntou esse nome nos últimos 300 s. Aperte tocar.' : 'O recursivo acabou de subir e não sabe nada além dos endereços da raiz. Aperte tocar.'));
        return Promise.resolve();
      }
      var p = passos[seq[i]];
      var a = nos[p.de], b = nos[p.para];
      a.g.classList.add('ativo'); b.g.classList.add('ativo');
      var chave = arestas[p.de + '-' + p.para] ? p.de + '-' + p.para : p.para + '-' + p.de;
      arestas[chave].classList.add('ativa');
      legenda.textContent = '';
      legenda.appendChild(el('strong', { text: (i + 1) + ' de ' + seq.length + ' · ' + a.t + ' → ' + b.t + ' ' }));
      legenda.appendChild(el('code', { text: p.p }));
      legenda.appendChild(el('p', { text: cache.checked && seq[i] === 7 ? 'A resposta sai direto do cache do recursivo, com o TTL já descontado. Raiz, .com e o autoritativo nem ficam sabendo.' : p.d }));
      var rotulo = bolha.lastChild, caixa = bolha.firstChild;
      rotulo.textContent = p.p;
      var largura = Math.max(60, p.p.length * 6.6 + 18);
      caixa.setAttribute('x', -largura / 2); caixa.setAttribute('width', largura);
      bolha.setAttribute('class', 'pacote' + (p.volta ? ' volta' : ''));
      bolha.style.display = '';
      var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function poe(t) {
        var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        x = Math.max(largura / 2 + 4, Math.min(W - largura / 2 - 4, x));
        bolha.setAttribute('transform', 'translate(' + x + ',' + (y - 42) + ')');
      }
      if (!animar || semMovimento) { poe(0.5); return Promise.resolve(); }
      return new Promise(function (ok) {
        var inicio = performance.now(), dur = 1100;
        (function tique(agora) {
          var t = Math.min(1, (agora - inicio) / dur);
          poe(0.12 + 0.76 * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
          if (t < 1) quadro = requestAnimationFrame(tique); else ok();
        })(inicio);
      });
    }

    function para() {
      tocando = false;
      if (quadro) cancelAnimationFrame(quadro);
      if (espera) clearTimeout(espera);
      bToca.textContent = '▶ Tocar';
    }

    function toca() {
      var seq = lista();
      if (atual >= seq.length - 1) atual = -1;
      tocando = true;
      bToca.textContent = '❚❚ Pausar';
      (function proximo() {
        if (!tocando) return;
        if (atual >= seq.length - 1) { para(); return; }
        mostra(atual + 1, true).then(function () {
          if (tocando) espera = setTimeout(proximo, 1700);
        });
      })();
    }

    bToca.addEventListener('click', function () { if (tocando) para(); else toca(); });
    bAnt.addEventListener('click', function () { para(); mostra(Math.max(-1, atual - 1), false); });
    bProx.addEventListener('click', function () { para(); mostra(Math.min(lista().length - 1, atual + 1), true); });
    cache.addEventListener('input', function () { para(); mostra(-1, false); });
    raiz.appendChild(tela);
    raiz.appendChild(el('div', { class: 'dnslab-form dnslab-controles' }, [bAnt, bToca, bProx, el('label', { class: 'dnslab-marca' }, [cache, ' cache quente'])]));
    raiz.appendChild(legenda);
    mostra(-1, false);
  };

  // -------------------------------------------------------------- ndots
  LABS.ndots = function (raiz) {
    var entrada = el('input', { type: 'text', value: 'api.github.com', spellcheck: 'false', autocapitalize: 'off' });
    var ndots = el('input', { type: 'number', min: '0', max: '15', value: '5' });
    var busca = el('input', { type: 'text', value: 'default.svc.cluster.local svc.cluster.local cluster.local', spellcheck: 'false' });
    var saida = el('div', { class: 'dnslab-saida' });
    var presets = el('div', { class: 'dnslab-exemplos' }, [
      'Cenários: ',
      el('button', { type: 'button', class: 'dnslab-link', text: 'pod no Kubernetes', onclick: function () { ndots.value = 5; busca.value = 'default.svc.cluster.local svc.cluster.local cluster.local'; calcula(); } }),
      el('button', { type: 'button', class: 'dnslab-link', text: 'glibc padrão', onclick: function () { ndots.value = 1; busca.value = 'exemplo.com.br'; calcula(); } }),
      el('button', { type: 'button', class: 'dnslab-link', text: 'serviço do cluster', onclick: function () { entrada.value = 'redis.cache'; ndots.value = 5; busca.value = 'default.svc.cluster.local svc.cluster.local cluster.local'; calcula(); } })
    ]);

    function calcula() {
      saida.textContent = '';
      var nome = entrada.value.trim().toLowerCase();
      if (!nome) return;
      var n = Math.max(0, Math.min(15, Number(ndots.value) || 0));
      var dominios = busca.value.trim().split(/\s+/).filter(Boolean);
      var absoluto = /\.$/.test(nome);
      var pontos = (nome.match(/\./g) || []).length;
      var tentativas = [];
      if (absoluto) {
        tentativas.push({ n: nome, m: 'termina em ponto: vai direto, sem search' });
      } else {
        var comBusca = dominios.map(function (d) { return { n: nome + '.' + d + '.', m: 'search' }; });
        var direto = { n: nome + '.', m: 'o nome como foi escrito' };
        tentativas = pontos >= n ? [direto].concat(comBusca) : comBusca.concat([direto]);
      }
      saida.appendChild(el('p', { class: 'dnslab-nota', text: absoluto
        ? 'Nome absoluto. Nem ndots nem search entram na história.'
        : '"' + nome + '" tem ' + pontos + (pontos === 1 ? ' ponto' : ' pontos') + ' e ndots é ' + n + ': ' + (pontos >= n ? 'tenta o nome puro primeiro, depois a search list.' : 'menos pontos que ndots, então passa pela search list inteira antes de tentar o nome puro.') }));
      var ol = el('ol', { class: 'dnslab-tentativas' });
      tentativas.forEach(function (t) {
        ol.appendChild(el('li', {}, [el('code', { text: t.n }), el('small', { text: ' ' + t.m })]));
      });
      saida.appendChild(ol);
      var pos = tentativas.map(function (t) { return t.m; }).indexOf('o nome como foi escrito');
      if (!absoluto && pos > 0) {
        saida.appendChild(el('p', { class: 'dnslab-nota', text: 'Se o nome certo for o último (um domínio de fora do cluster, por exemplo), são ' + pos + ' tentativas erradas antes dele. Cada tentativa são duas consultas, A e AAAA: ' + (pos * 2) + ' respostas NXDOMAIN pra cada resolução. Escrever "' + nome + '." com o ponto no fim, ou baixar o ndots do pod, acaba com isso.' }));
      }
    }
    [entrada, ndots, busca].forEach(function (c) { c.addEventListener('input', calcula); });
    raiz.appendChild(el('div', { class: 'dnslab-form' }, [campo('Nome que a aplicação pediu', entrada), campo('ndots', ndots)]));
    raiz.appendChild(el('div', { class: 'dnslab-form' }, [campo('search', busca)]));
    raiz.appendChild(presets);
    raiz.appendChild(saida);
    calcula();
  };

  function liga() {
    Array.prototype.forEach.call(document.querySelectorAll('.dnslab[data-lab]'), function (caixa) {
      var lab = LABS[caixa.dataset.lab];
      if (!lab || caixa.dataset.pronto) return;
      caixa.dataset.pronto = '1';
      var corpo = caixa.querySelector('.dnslab-corpo');
      corpo.textContent = '';
      try { lab(corpo); } catch (e) { corpo.appendChild(el('p', { class: 'dnslab-erro', text: 'Este exemplo interativo não carregou neste navegador.' })); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga();
})();
