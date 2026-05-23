# Meu Orquestrador

Implementação inicial de **Workforce real** com:

- Registro de agentes com toolkits próprios.
- Planejamento e execução de subtarefas.
- Roteamento de subtarefas para agentes específicos.
- Resultado consolidado de execução por tarefa.
- Modos de execução `SUBAGENT` e `TEAM`.

## Estruturas principais

- `Toolkit`: registra e executa ferramentas por nome.
- `Agent`: executa subtarefas usando seu toolkit.
- `Subtask`: unidade de execução (descrição, tool, parâmetros, status, saída/erro).
- `Workforce`: recebe objetivo, planeja subtarefas e orquestra execução.
- `WorkforceExecution`: agrega status final da execução, modo e eventos.
- `ExecutionMode`: define estratégia de execução (`SUBAGENT` ou `TEAM`).
- `TeamContext`: canal compartilhado para troca de mensagens entre agentes no modo `TEAM`.

## Pré-requisitos

1. Python 3.10+ instalado.
2. `pip` disponível no terminal.

## Passo a passo para executar a aplicação

### 1) Clonar o repositório

```bash
git clone <url-do-repositorio>
cd meu-orquestrador
```

### 2) Criar e ativar ambiente virtual

#### Linux/macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### Windows (PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3) (Opcional) Atualizar ferramentas básicas do Python

```bash
python -m pip install --upgrade pip setuptools wheel
```

### 4) Executar um exemplo funcional

Crie o arquivo `run_example.py` na raiz do projeto com o conteúdo abaixo:

```python
from workforce import Workforce, Toolkit, Agent, Subtask


class EchoTool:
    name = "echo"

    def run(self, **kwargs):
        return kwargs.get("text", "")


def planner(objective: str):
    return [
        Subtask(
            description="Responder objetivo",
            tool_name="echo",
            params={"text": objective},
        )
    ]


def router(subtask: Subtask):
    return "assistant"


toolkit = Toolkit()
toolkit.register(EchoTool())

agent = Agent(name="assistant", toolkit=toolkit)
workforce = Workforce(
    planner=planner,
    agents={"assistant": agent},
    task_router=router,
)

result = workforce.execute(task_id="task-1", objective="Olá")

print("Status:", result.status)
print("Saída:", result.subtasks[0].output)
```

Agora execute:

```bash
python run_example.py
```

Saída esperada (aproximada):

```text
Status: TaskStatus.COMPLETED
Saída: Olá
```

## Como validar com testes

Instale o `pytest` e execute os testes automatizados:

```bash
pip install pytest
pytest -q
```

Se tudo estiver correto, o teste deve finalizar com sucesso.

## Exemplo rápido

```python
from workforce import Workforce, Toolkit, Agent, Subtask

class EchoTool:
    name = "echo"

    def run(self, **kwargs):
        return kwargs.get("text", "")


def planner(objective: str):
    return [Subtask(description="Responder objetivo", tool_name="echo", params={"text": objective})]


def router(subtask: Subtask):
    return "assistant"


toolkit = Toolkit()
toolkit.register(EchoTool())

agent = Agent(name="assistant", toolkit=toolkit)
workforce = Workforce(planner=planner, agents={"assistant": agent}, task_router=router)

result = workforce.execute(task_id="task-1", objective="Olá")
print(result.status)
print(result.subtasks[0].output)
```

## Modos de execução

### 1) `SUBAGENT` (comportamento padrão)

Mantém o orquestrador central e **não** compartilha contexto entre subtarefas/agentes.

```python
from workforce import Workforce, ExecutionMode

workforce = Workforce(
    planner=planner,
    agents={"assistant": agent},
    task_router=router,
    execution_mode=ExecutionMode.SUBAGENT,
)

result = workforce.execute(task_id="task-subagent", objective="Olá")
print(result.mode)  # ExecutionMode.SUBAGENT
print(result.events)  # eventos de início/fim e execução de subtarefas
```

### 2) `TEAM` (troca de mensagens)

Compartilha um `TeamContext` em `subtask.params["team_context"]` para permitir colaboração.

```python
from workforce import Workforce, ExecutionMode, Subtask

class PublishTool:
    name = "publish"

    def run(self, **kwargs):
        kwargs["team_context"].publish(sender="agente-a", content="contexto pronto")
        return "ok"


class ReadTool:
    name = "read"

    def run(self, **kwargs):
        return kwargs["team_context"].read_all()


def planner_team(_objective: str):
    return [
        Subtask(id="A", description="publicar", tool_name="publish"),
        Subtask(id="B", description="ler", tool_name="read", depends_on=["A"]),
    ]


workforce = Workforce(
    planner=planner_team,
    agents={"assistant": agent},
    task_router=router,
    execution_mode=ExecutionMode.TEAM,
)

result = workforce.execute(task_id="task-team", objective="Colaborar")
print(result.mode)  # ExecutionMode.TEAM
print(result.events)  # inclui eventos team_context_shared
```

## TaskBoard e claims

O orquestrador usa um `TaskBoard` com `claim_next(agent_name)` protegido por lock para coordenar consumo de subtarefas pendentes, com marcação em `Subtask.claimed_by` e `Subtask.claimed_at`.

### Limitações

- Thread-safe apenas em processo local (uso de `threading.Lock`).
- Não há coordenação distribuída entre múltiplos processos/máquinas.
- Para distribuição real, seria necessário backend externo (ex.: fila, banco com lock/lease).

## Integração com LLM local gratuito (Ollama)

Para testar a lógica do backend com um modelo gratuito/local, você pode usar o `OllamaTool`.

### 1) Instalar e subir o Ollama

```bash
# macOS/Linux (via instalador oficial)
ollama serve
ollama pull llama3.2:3b
```

### 2) Registrar a tool no orquestrador

```python
from ollama_tool import OllamaTool

toolkit = Toolkit()
toolkit.register(OllamaTool(model="llama3.2:3b"))
```

### 3) Criar subtask que chama o modelo

```python
Subtask(
    description="Gerar rascunho",
    tool_name="ollama_generate",
    params={"prompt": "Resuma os próximos passos do objetivo em 3 bullets."},
)
```

### Observações

- A tool usa a API local em `http://localhost:11434/api/generate`.
- É possível sobrescrever o modelo por subtask com `params={"model": "..."}`.
- Em ambiente sem Ollama rodando, a subtask falhará e o erro ficará em `subtask.error`.
