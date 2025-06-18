# BlueLamp CLI

AI-powered development assistant CLI tool.

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Usage

```bash
npm start
# or after build
node dist/cli/index.js
```

## Directory Structure

```
bluelamp-cli/
├── src/
│   ├── cli/              # CLI entry point and command handlers
│   │   └── commands/     # Individual command implementations
│   ├── core/             # Core functionality
│   ├── agents/           # AI agent implementations
│   │   ├── requirements/ # Requirements analysis agent
│   │   ├── mockup/       # Mockup generation agent
│   │   ├── data-model/   # Data model design agent
│   │   ├── architecture/ # Architecture design agent
│   │   └── planning/     # Project planning agent
│   ├── diff/             # Diff and merge utilities
│   └── integration/      # External service integrations
├── prompts/              # AI prompts
│   ├── encrypted/        # Encrypted prompt storage
│   └── keys/             # Encryption keys (gitignored)
├── templates/            # Project templates
│   └── handover/         # Handover documentation templates
└── config/               # Configuration files
```