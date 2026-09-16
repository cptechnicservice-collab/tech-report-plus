# CP Technician Log

Crie um app mobile-first chamado "CP TECHNIC Horas" para uso diário no iPhone por um técnico de campo. Quero um visual moderno, minimalista e premium, parecido com um app nativo: fundo claro, cartões brancos, cantos arredondados, espaçamento amplo, tipografia limpa, botões grandes e uma barra de navegação inferior. Não usar cronômetro; todos os horários são preenchidos manualmente e devem abrir em branco.

Tela principal "Novo apontamento": Data; Cliente com lista pesquisável; botão "+ Novo cliente" que realmente cadastra o cliente para usos futuros; Máquina / Serviço opcional; seção Viagem ida com Saída e Chegada opcionais; seção Trabalho com Início e Fim; Intervalo Início e Fim opcionais; seção Viagem retorno com Saída e Chegada opcionais; KM inicial e KM final opcionais; Observações opcional. Mostrar em tempo real Horas trabalhadas, Horas de viagem e KM rodados. Nunca preencher hora atual automaticamente e não usar 00:00 como padrão.

Criar também tela "Clientes" para cadastrar e editar Nome, Cidade, CNPJ opcional, Contato, Telefone, Ativo e Observações. Na tela de apontamento, clientes ativos devem aparecer em lista, com pesquisa e clientes recentes primeiro.

Criar tela "Histórico" com lista de apontamentos por data e cliente, busca/filtro por cliente e período, possibilidade de abrir e editar um apontamento existente. Criar também uma tela inicial/resumo simples com total de horas trabalhadas, horas de viagem e km do período atual.

Use banco de dados interno do Lovable para funcionar já no teste, com tabelas relacionadas de clientes e apontamentos. Deixe a estrutura preparada para posteriormente sincronizar ou conectar com Google Sheets. Adicione o cliente inicial "LEO MADEIRA BRASILIA". O app deve ser otimizado para iPhone e fácil de adicionar à Tela de Início.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tech-report-plus.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/12741038-7be1-41bb-bc69-ef4db48f0b05).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
