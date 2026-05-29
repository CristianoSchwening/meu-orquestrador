# Repositório da Fase 1 ADK Python

A implementação greenfield da **Fase 1 — Fundação ADK Python** foi migrada para um repositório dedicado:

- <https://github.com/CristianoSchwening/adk-agent-orchestrator>

## Decisão de organização

Este repositório (`meu-orquestrador`) deve continuar concentrando:

- o orquestrador legado em Python;
- o contrato entre engine e UI;
- a UI/mockups e documentação comparativa;
- os documentos de arquitetura e plano de migração.

O repositório `adk-agent-orchestrator` deve concentrar a nova implementação ADK-only, começando pela Fase 1 com:

- `RootOrchestratorAgent`;
- `Runner` do ADK;
- `SessionService` e `ArtifactService` in-memory;
- configuração do projeto Python;
- testes, lint e CI próprios.

## Consequência prática

O scaffold `adk-agent-orchestrator/` não deve ser mantido dentro deste repositório para evitar duplicidade, divergência entre bases de código e confusão sobre qual repositório é a fonte de verdade da implementação ADK.
