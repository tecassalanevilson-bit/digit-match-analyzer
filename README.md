# Digit Match Analyzer

MODIFICAR O PROJETO ATUAL. NÃO CRIAR UM PROJETO NOVO.



Quero finalizar o Digit Scanner AI como uma plataforma leve, rápida e profissional para análise de DIGIT MATCHES e DIFFERS da Deriv.



O foco principal deve ser MATCHES.



IMPORTANTE:

Não quero uma plataforma que simplesmente escolha o dígito mais frequente.

Quero um scanner estatístico seletivo que combine vários fatores, dê um SCORE de 0–100 e também saiba dizer AGUARDAR quando não existir uma condição suficientemente forte.



Não prometer precisão ou lucro.

A taxa de acerto deve ser medida somente através de resultados reais registrados pelo sistema.



==================================================

1. API DA DERIV — PARTE MAIS IMPORTANTE

==================================================



Usar a API atual da Deriv e não exemplos antigos da Legacy API.



Conectar ao WebSocket público:



wss://ws.binaryws.com/websockets/v3



Não pedir token, senha ou credenciais para análise de mercado.



Primeiro consultar:



active_symbols



para descobrir os símbolos atualmente disponíveis.



A API atual utiliza:



underlying_symbol

underlying_symbol_name

underlying_symbol_type

pip_size



Não assumir que códigos antigos como R_75 são sempre válidos.



Depois utilizar:



ticks_history



para obter o histórico.



Utilizar:



ticks



para receber novos ticks em tempo real.



Implementar tratamento de erros e reconexão automática.



Se a conexão cair:



1. mostrar “CONEXÃO PERDIDA”;

2. tentar reconectar automaticamente;

3. continuar a análise quando a conexão voltar.



==================================================

2. ÍNDICES

==================================================



Criar um menu:



ÍNDICE



Mostrar os índices sintéticos disponíveis atualmente na API.



Dar prioridade visual aos índices de volatilidade.



Exemplos, se estiverem disponíveis:



Volatility 10

Volatility 25

Volatility 50

Volatility 75

Volatility 100



e versões 1s quando disponíveis.



Não escrever os símbolos manualmente como R_75.



Usar os símbolos retornados pela API.



==================================================

3. TAMANHO DA ANÁLISE

==================================================



Criar:



AMOSTRA



Opções:



50 ticks

100 ticks

300 ticks

500 ticks

1000 ticks

2000 ticks



Padrão:



300 ticks.



==================================================

4. BOTÃO ATUALIZAR

==================================================



Criar um botão grande:



🔄 ATUALIZAR AGORA



Ao pressionar:



- buscar novamente o histórico;

- recalcular todos os dígitos;

- atualizar o ranking;

- atualizar o score;

- atualizar o sinal;

- atualizar a distribuição;

- atualizar os últimos ticks.



Mostrar:



Última atualização: HH:MM:SS



==================================================

5. MODO LIVE

==================================================



Criar:



🟢 LIVE



Quando ativado:



- receber cada novo tick através de ticks;

- extrair o último dígito;

- adicionar à janela;

- remover o tick mais antigo quando ultrapassar o limite;

- recalcular as estatísticas;

- atualizar o painel.



Não recarregar a página.



Não atualizar a página inteira a cada tick.



O sistema deve ser leve para Android e especialmente para Samsung Galaxy A10s.



==================================================

6. ÚLTIMOS TICKS

==================================================



Mostrar uma faixa:



ÚLTIMOS 20 DÍGITOS



Exemplo:



7 2 5 5 1 8 7 3 7 0 4 9 2 7 1 5 8 8 3 7



Atualizar em tempo real.



==================================================

7. DISTRIBUIÇÃO DOS DÍGITOS

==================================================



Criar gráfico dos dígitos:



0 1 2 3 4 5 6 7 8 9



Para cada dígito mostrar:



Quantidade

Porcentagem

Diferença em relação aos 10%



Exemplo:



Dígito 7

15 ocorrências

15%

+5% acima do esperado



Usar:



🟢 acima da média

🔴 abaixo da média

⚪ próximo da média



IMPORTANTE:



Não interpretar automaticamente um dígito acima de 10% como sinal de MATCH.



==================================================

8. ANÁLISE DE CADA DÍGITO

==================================================



Para cada dígito 0–9 calcular:



1. Frequência total.

2. Frequência dos últimos 20 ticks.

3. Frequência dos últimos 50 ticks.

4. Frequência da janela escolhida.

5. Diferença para 10%.

6. Quantos ticks passaram desde a última ocorrência.

7. Sequência atual.

8. Maior sequência encontrada na janela.

9. Frequência recente versus frequência histórica.

10. Estabilidade da frequência.



Mostrar esses dados de forma simples.



==================================================

9. MATCH ANALYZER

==================================================



Criar uma seção principal:



🎯 MATCH ANALYZER



O sistema deve calcular um SCORE de 0–100 para cada dígito.



O score deve combinar:



Frequência:

25 pontos



Comportamento recente:

20 pontos



Comparação entre janela curta e longa:

15 pontos



Desvio estatístico em relação aos 10%:

15 pontos



Consistência:

10 pontos



Sequência/histórico:

10 pontos



Dados suficientes:

5 pontos



Total:



100 pontos.



IMPORTANTE:



O score NÃO significa “X% de probabilidade de acertar”.



É apenas um score interno de qualidade da condição estatística.



Mostrar:



🥇 Melhor candidato

🥈 Segundo candidato

🥉 Terceiro candidato



==================================================

10. FILTRO DE QUALIDADE

==================================================



O sistema NÃO deve gerar sinal em qualquer situação.



Criar:



🟢 CONDIÇÃO FORTE

🟡 CONDIÇÃO MODERADA

🔴 AGUARDAR



Regra:



Score abaixo de 60:

AGUARDAR



Score de 60 a 74:

CONDIÇÃO MODERADA



Score de 75 ou superior:

CONDIÇÃO FORTE



Mas o score sozinho NÃO é suficiente.



Também exigir confirmação de múltiplas janelas.



Por exemplo:



20/50 ticks

versus

300 ticks



Se o comportamento for contraditório, reduzir o score ou mostrar AGUARDAR.



Se os dados forem insuficientes ou contraditórios:



AGUARDAR.



O objetivo é gerar MENOS sinais e sinais mais filtrados, em vez de gerar sinais constantemente.



==================================================

11. MATCH

==================================================



Criar:



🎯 MATCH



Mostrar:



Dígito:

7



Score:

78/100



Frequência:

14.7%



Última ocorrência:

X ticks atrás



Sequência atual:

X



Condição:

FORTE / MODERADA / AGUARDAR



Explicação:



Mostrar de forma simples POR QUE o sistema escolheu aquele dígito.



==================================================

12. DIFFER

==================================================



Criar também:



🚫 DIFFER



Mostrar os dígitos com menor suporte estatístico na janela.



Mas não recomendar DIFFER simplesmente porque um dígito está “frio”.



Utilizar os mesmos filtros estatísticos.



==================================================

13. COMPARAÇÃO DE JANELAS

==================================================



Criar uma seção:



📊 CONFIRMAÇÃO



Comparar:



20 ticks

50 ticks

100 ticks

300 ticks

500 ticks



Para cada dígito mostrar se está:



SUBINDO

ESTÁVEL

DESCENDO



Exemplo:



Dígito 7



20 ticks: 15%

50 ticks: 14%

300 ticks: 13%



Tendência estatística:

ESTÁVEL/FAVORÁVEL



Se as janelas divergirem muito:



⚠️ CONFLITO — AGUARDAR



==================================================

14. BACKTEST

==================================================



Esta é uma das partes mais importantes.



Criar:



📈 BACKTEST DOS SINAIS



Sempre que o scanner produzir um sinal, registrar:



Hora

Índice

Modo

Dígito

Score

Janela

Resultado



Depois verificar o resultado real no próximo tick correspondente à condição analisada.



Mostrar:



Total de sinais

Acertos

Erros

Taxa de acerto



Exemplo:



100 sinais

64 acertos

36 erros

64% de acerto



Nunca escrever:



“98% garantido”



Nunca inventar resultados.



==================================================

15. TAXA DE ACERTO POR DÍGITO

==================================================



Criar ranking:



Dígito | Sinais | Acertos | Erros | Taxa



Exemplo:



7 | 30 | 20 | 10 | 66.7%

3 | 25 | 17 | 8 | 68.0%



Isso permitirá descobrir quais condições realmente funcionam melhor.



==================================================

16. TAXA POR ÍNDICE

==================================================



Criar também:



Índice | Sinais | Acertos | Erros | Taxa



Assim será possível descobrir se uma estratégia funciona melhor em determinado índice.



==================================================

17. HISTÓRICO DOS SINAIS

==================================================



Mostrar os últimos 20 sinais:



Hora

Índice

Dígito

Match/Differ

Score

Resultado



Usar:



✅ ACERTO

❌ ERRO

⏳ PENDENTE



==================================================

18. FILTRO DE OPERAÇÃO

==================================================



Criar uma opção:



MODO CONSERVADOR



Quando ligado:



Só mostrar sinal quando:



- Score >= 75

- houver dados suficientes;

- duas ou mais janelas confirmarem;

- não houver conflito forte entre as janelas;

- conexão estiver estável.



Caso contrário:



AGUARDAR.



Criar também:



MODO NORMAL



Score >= 60.



Padrão:



MODO CONSERVADOR.



==================================================

19. ALERTA

==================================================



Quando surgir uma condição forte:



mostrar:



🔔 CONDIÇÃO FORTE DETECTADA



Índice:

Volatility 75



Modo:

MATCH



Dígito:

7



Score:

81/100



Mas deixar claro:



“Score estatístico, não garantia de acerto.”



Não executar operações automaticamente.



==================================================

20. PAINEL PRINCIPAL

==================================================



No topo mostrar:



DIGIT SCANNER AI



Estado:

🟢 LIVE



Índice:

Volatility 75



Último preço:

XXXX



Último dígito:

7



Ticks analisados:

300



Última atualização:

HH:MM:SS



==================================================

21. PERFORMANCE PARA GALAXY A10S

==================================================



O aplicativo precisa ser leve.



Evitar:



- animações pesadas;

- gráficos 3D;

- bibliotecas desnecessárias;

- processamento excessivo;

- atualização completa da interface a cada tick.



Usar atualizações eficientes.



O aplicativo deve funcionar bem em navegador Android.



==================================================

22. DESIGN

==================================================



Usar um design semelhante às referências que forneci:



- fundo escuro;

- roxo;

- amarelo/dourado;

- verde para condições favoráveis;

- vermelho para erros;

- cartões grandes;

- botões fáceis de tocar no telefone.



Mas priorizar velocidade e legibilidade.



==================================================

23. SEGURANÇA

==================================================



Não pedir:



senha da Deriv

token da Deriv

número do cartão

credenciais bancárias.



Não executar trades automaticamente.



A aplicação é somente para análise.



==================================================

24. VALIDAÇÃO ANTES DE TERMINAR

==================================================



Antes de considerar o trabalho concluído, testar:



1. A API conecta.

2. active_symbols retorna símbolos.

3. O dropdown mostra os símbolos atuais.

4. ticks_history retorna preços e horários.

5. ticks recebe novos preços.

6. O último dígito é calculado corretamente.

7. A distribuição dos 0–9 é calculada corretamente.

8. O botão ATUALIZAR funciona.

9. LIVE funciona.

10. O botão PARAR funciona.

11. A reconexão funciona.

12. O Match Analyzer funciona.

13. O Score funciona.

14. O Backtest registra resultados.

15. A taxa de acerto é calculada pelos resultados reais.

16. O aplicativo não usa R_75 como símbolo fixo.

17. O aplicativo funciona no navegador Android.

18. Não existem erros no console.



Se alguma parte não estiver funcionando, corrigir antes de terminar.



NÃO adicionar funcionalidades desnecessárias.



PRIORIDADE ABSOLUTA:



1. Dados reais da Deriv.

2. Conexão estável.

3. Análise correta dos últimos dígitos.

4. Matches.

5. Filtro conservador.

6. Backtest.

7. Taxa de acerto real.

8. Performance no celular.

9. Interface bonita.



Não adicionar IA generativa pesada se ela não melhorar a análise estatística.



A plataforma deve preferir dizer AGUARDAR a produzir um sinal fraco.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/211a02ac-fb82-4e33-878a-da9b6268a98a).

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
