import type { Tool } from '../types/workforce'

export const MOCK_TOOLS: Tool[] = [
  {
    name: 'web_browse',
    description: 'Navega para uma URL e retorna o conteúdo da página.',
    category: 'Web',
    params: [
      { name: 'url', type: 'string', required: true },
      { name: 'wait_for', type: 'string', required: false },
    ],
  },
  {
    name: 'web_search',
    description: 'Realiza buscas na web e retorna resultados relevantes.',
    category: 'Web',
    params: [
      { name: 'query', type: 'string', required: true },
      { name: 'num_results', type: 'number', required: false },
    ],
  },
  {
    name: 'screenshot',
    description: 'Captura screenshot da tela ou de um elemento específico.',
    category: 'Web',
    params: [
      { name: 'selector', type: 'string', required: false },
      { name: 'full_page', type: 'boolean', required: false },
    ],
  },
  {
    name: 'terminal',
    description: 'Executa comandos no terminal do sistema.',
    category: 'Shell',
    params: [
      { name: 'command', type: 'string', required: true },
      { name: 'timeout', type: 'number', required: false },
    ],
  },
  {
    name: 'code_exec',
    description: 'Executa código Python ou JavaScript em sandbox isolado.',
    category: 'Code',
    params: [
      { name: 'code', type: 'string', required: true },
      { name: 'language', type: 'string', required: false },
    ],
  },
  {
    name: 'file_read',
    description: 'Lê o conteúdo de um arquivo do sistema de arquivos.',
    category: 'Files',
    params: [
      { name: 'path', type: 'string', required: true },
      { name: 'encoding', type: 'string', required: false },
    ],
  },
  {
    name: 'file_write',
    description: 'Escreve ou cria um arquivo no sistema de arquivos.',
    category: 'Files',
    params: [
      { name: 'path', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
    ],
  },
  {
    name: 'data_analysis',
    description: 'Analisa um conjunto de dados e retorna estatísticas e insights.',
    category: 'Analysis',
    params: [
      { name: 'data', type: 'object', required: true },
      { name: 'metrics', type: 'array', required: false },
    ],
  },
  {
    name: 'chart_gen',
    description: 'Gera gráficos e visualizações a partir de dados estruturados.',
    category: 'Visualization',
    params: [
      { name: 'data', type: 'object', required: true },
      { name: 'chart_type', type: 'string', required: true },
      { name: 'title', type: 'string', required: false },
    ],
  },
  {
    name: 'pdf_gen',
    description: 'Gera documentos PDF a partir de conteúdo HTML ou Markdown.',
    category: 'Documents',
    params: [
      { name: 'content', type: 'string', required: true },
      { name: 'filename', type: 'string', required: false },
    ],
  },
  {
    name: 'sql_query',
    description: 'Executa queries SQL em banco de dados configurado.',
    category: 'Database',
    params: [
      { name: 'query', type: 'string', required: true },
      { name: 'database', type: 'string', required: false },
    ],
  },
]
