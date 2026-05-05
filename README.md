# Meu Orquestrador

Implementação inicial de **Workforce real** com:

- Registro de agentes com toolkits próprios.
- Planejamento e execução de subtarefas.
- Roteamento de subtarefas para agentes específicos.
- Resultado consolidado de execução por tarefa.

## Estruturas principais

- `Toolkit`: registra e executa ferramentas por nome.
- `Agent`: executa subtarefas usando seu toolkit.
- `Subtask`: unidade de execução (descrição, tool, parâmetros, status, saída/erro).
- `Workforce`: recebe objetivo, planeja subtarefas e orquestra execução.
- `WorkforceExecution`: agrega status final da execução.

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
