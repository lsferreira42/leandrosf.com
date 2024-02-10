[www.leandrosf.com](https://www.leandrosf.com/)
=========================

Este repositório contém o código-fonte para [www.leandrosf.com](https://www.leandrosf.com),
que consiste em documentos markdown e um gerador de site estático controlado por Makefile.

# Requisitos

- coreutils
- python3
- pandoc
- make

# Instruções

Primeiro, instale os requisitos do `pip`:

    make install

Você vai querer editar o [Makefile](Makefile) para definir a URL do seu site,
título do feed RSS, etc.

Depois, comece a escrever documentos markdown no diretório `src`. Você pode usar
qualquer convenção de nomenclatura e estrutura de diretórios que desejar. Arquivos terminados em
`.md` serão convertidos para `.html` com o mesmo caminho.

O diretório `src/blog` é especial. Arquivos markdown neste diretório são
usados para povoar a lista do blog na página principal em [index.md](src/index.md).
Antes do pandoc converter este arquivo para HTML, a string especial `__BLOG_LIST__`
é substituída pela saída de [bloglist.py](scripts/bloglist.py).
Este script Python produz uma lista markdown de todos os seus posts no blog ordenada por data.

Cada arquivo markdown pode ter um frontmatter YAML com os seguintes metadados:

    ---
    title: Um post de blog chato
    date: YYYY-MM-DD
    subtitle: um subtítulo opcional
    heading: opcional, se você quiser que o primeiro <h1> seja diferente de <title>
    description: opcional, descrição curta para <head> e a listagem do blog
    draft: se definido, esconde o post da listagem do blog
    ---

Você pode mudar o HTML resultante modificando o [template](templates/default.html).
Mudar o formato da listagem do blog requer a modificação do script Python.

Construa o site usando o alvo padrão:

    make

Isso criará um diretório chamado `public` contendo todos os seus arquivos markdown
renderizados para HTML.

Você também pode rodar um servidor web local, que escuta na porta 8000, usando:

    make serve
