import type { PlaygroundScenario } from '../types/workforce'

export const PLAYGROUND_SCENARIOS: PlaygroundScenario[] = [
  {
    id: 'scenario-ticket',
    name: 'Ticket Automation',
    objective:
      'Go to my ticket management system http://localhost:9229/mock_website.html, check the tickets need to be added in my local path /Users/enrei/Desktop/new_tickets, add all the new tickets into my system, then generate a detailed statistical report for all the tickets in the system. The report should include charts and diagrams for data visualization.',
    agent_ids: ['browser-agent', 'developer-agent', 'document-agent'],
    subtasks: [
      {
        id: 'pt-001',
        description: 'Access ticket management system at http://localhost:9229/mock_website.html using a web browser. Take a screenshot of the current state of the system and document what tickets are currently visible. Save this information as a text summary describing the existing tickets in the system.',
        tool_name: 'web_browse',
        agent_id: 'browser-agent',
        depends_on: [],
      },
      {
        id: 'pt-002',
        description: 'Read all ticket files from the local directory /Users/enrei/Desktop/new_tickets. Extract the ticket information from each file and compile a complete list of new tickets that need to be added to the system. Return the ticket data as a structured JSON format with all relevant ticket details.',
        tool_name: 'file_read',
        agent_id: 'developer-agent',
        depends_on: [],
      },
      {
        id: 'pt-003',
        description: 'Using the ticket management system at http://localhost:9229/mock_website.html, add all the new tickets provided from the /Users/enrei/Desktop/new_tickets directory. Use web browser automation to navigate the interface, fill in ticket forms, and submit each new ticket. Confirm successful addition of each ticket by verifying they appear in the system.',
        tool_name: 'web_browse',
        agent_id: 'browser-agent',
        depends_on: ['pt-001', 'pt-002'],
      },
      {
        id: 'pt-004',
        description: 'Generate a comprehensive statistical report for all tickets in the system using the provided ticket data. The report should include: 1) Summary statistics (total tickets, by status, by priority), 2) Data visualizations including bar charts for ticket status distribution, pie chart for priority breakdown, line chart for ticket creation trends over time, and 3) Key insights and recommendations.',
        tool_name: 'chart_gen',
        agent_id: 'document-agent',
        depends_on: ['pt-003'],
      },
    ],
    delays: [0, 200, 2800, 3200, 7500],
  },
  {
    id: 'scenario-research',
    name: 'Market Research',
    objective:
      'Search for top 5 competitors in the SaaS project management space, scrape their pricing pages, compile a comparison table and generate an executive summary report.',
    agent_ids: ['browser-agent', 'analyst-agent', 'document-agent'],
    subtasks: [
      {
        id: 'pr-001',
        description: 'Search the web for top SaaS project management competitors and their pricing pages.',
        tool_name: 'web_search',
        agent_id: 'browser-agent',
        depends_on: [],
      },
      {
        id: 'pr-002',
        description: 'Scrape pricing information from each identified competitor website.',
        tool_name: 'web_browse',
        agent_id: 'browser-agent',
        depends_on: ['pr-001'],
      },
      {
        id: 'pr-003',
        description: 'Analyze pricing data and identify market patterns and positioning.',
        tool_name: 'data_analysis',
        agent_id: 'analyst-agent',
        depends_on: ['pr-002'],
      },
      {
        id: 'pr-004',
        description: 'Generate executive summary report with comparison table and strategic recommendations.',
        tool_name: 'pdf_gen',
        agent_id: 'document-agent',
        depends_on: ['pr-003'],
      },
    ],
    delays: [0, 200, 4200, 8100, 12500],
  },
  {
    id: 'scenario-code',
    name: 'Code Review',
    objective:
      'Analyze the Python codebase in /src, run linting and tests, review code quality, and produce a detailed review report with prioritized recommendations.',
    agent_ids: ['developer-agent', 'reviewer-agent', 'document-agent'],
    subtasks: [
      {
        id: 'pc-001',
        description: 'Run static analysis (pylint, flake8) and collect all warnings and errors.',
        tool_name: 'terminal',
        agent_id: 'developer-agent',
        depends_on: [],
      },
      {
        id: 'pc-002',
        description: 'Execute test suite with pytest and collect code coverage report.',
        tool_name: 'code_exec',
        agent_id: 'developer-agent',
        depends_on: ['pc-001'],
      },
      {
        id: 'pc-003',
        description: 'Review static analysis and test results, score code quality dimensions.',
        tool_name: 'review',
        agent_id: 'reviewer-agent',
        depends_on: ['pc-002'],
      },
      {
        id: 'pc-004',
        description: 'Compile all findings into a comprehensive code review report with recommendations.',
        tool_name: 'pdf_gen',
        agent_id: 'document-agent',
        depends_on: ['pc-003'],
      },
    ],
    delays: [0, 200, 5100, 9400, 13800],
  },
]
