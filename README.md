# GitHub PR Review Dashboard MCP App

A Model Context Protocol (MCP) application that provides an interactive dashboard for reviewing and managing GitHub pull requests. This app allows you to view, approve, request changes, comment on, and merge pull requests through a beautiful web interface.

## Features

- 🎯 **Interactive PR Dashboard** - View all pull requests with detailed information
- ✅ **Approve PRs** - Quickly approve pull requests with optional comments
- ⚠️  **Request Changes** - Request changes on PRs with detailed feedback
- 💬 **Comment on PRs** - Add review comments to any pull request
- 🔀 **Merge PRs** - Merge pull requests using different merge strategies (merge, squash, rebase)
- 🔍 **Advanced Filtering** - Filter PRs by state, author, reviewer, and more
- 📊 **PR Statistics** - View additions, deletions, changed files, and commit counts
- 🏷️  **Labels & Reviews** - See all labels and review statuses at a glance

## Requirements

- **Node.js 24.0.0 or higher** - This application requires Node.js version 24 or above
- **GitHub Personal Access Token** - Required for API access

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ajaychinthapalli/github-pr-review-dashboard-mcp-app.git
   cd github-pr-review-dashboard-mcp-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   GITHUB_TOKEN=your_github_personal_access_token_here
   PORT=3001  # Optional, defaults to 3001
   ```

   To create a GitHub Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token"
   - Select scopes: `repo` (full control of private repositories)
   - Copy the generated token to your `.env` file

## Usage

### Development Mode

Run both build and server in development mode:
```bash
npm run dev
```

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   npm run serve
   ```

The server will start on `http://localhost:3001` (or the PORT specified in your `.env` file).

### Available Endpoints

- **MCP Server**: `POST http://localhost:3001/mcp`
- **Health Check**: `GET http://localhost:3001/health`

## MCP Tools

The application exposes the following MCP tools:

### 1. list-pull-requests

Display an interactive dashboard of pull requests for a GitHub repository.

**Parameters:**
- `repository` (required): Repository in format 'owner/repo'
- `state` (optional): Filter by PR state - 'open', 'closed', or 'all' (default: 'open')
- `author` (optional): Filter by PR author username
- `sortBy` (optional): Sort PRs by 'created', 'updated', or 'popularity' (default: 'created')

**Example:**
```json
{
  "repository": "facebook/react",
  "state": "open",
  "sortBy": "updated"
}
```

### 2. approve-pr

Approve a pull request.

**Parameters:**
- `repository` (required): Repository in format 'owner/repo'
- `prNumber` (required): Pull request number
- `comment` (optional): Approval comment

### 3. request-changes

Request changes on a pull request.

**Parameters:**
- `repository` (required): Repository in format 'owner/repo'
- `prNumber` (required): Pull request number
- `comment` (required): Comment explaining requested changes

### 4. comment-on-pr

Add a comment to a pull request.

**Parameters:**
- `repository` (required): Repository in format 'owner/repo'
- `prNumber` (required): Pull request number
- `comment` (required): Comment text

### 5. merge-pr

Merge a pull request.

**Parameters:**
- `repository` (required): Repository in format 'owner/repo'
- `prNumber` (required): Pull request number
- `method` (optional): Merge method - 'merge', 'squash', or 'rebase' (default: 'merge')

## Project Structure

```
.
├── server.ts              # MCP server and Express application
├── pr-dashboard.html      # HTML template for the dashboard UI
├── src/
│   ├── pr-dashboard.ts    # Client-side TypeScript for dashboard functionality
│   ├── types/
│   │   └── github.ts      # TypeScript interfaces for GitHub data
│   └── utils/
│       └── api.ts         # GitHub API wrapper class
├── dist/                  # Built output (generated)
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── README.md              # This file
```

## Development

### Type Checking

Check TypeScript types without building:
```bash
npm run typecheck
```

### Building

Build the dashboard HTML bundle:
```bash
npm run build
```

This uses Vite to bundle the TypeScript and HTML into a single file in the `dist/` directory.

## Architecture

The application consists of three main components:

1. **MCP Server** (`server.ts`)
   - Implements the Model Context Protocol server
   - Registers MCP tools for PR operations
   - Handles GitHub API authentication
   - Serves the dashboard UI as an MCP resource

2. **Express HTTP Server** (`server.ts`)
   - Provides HTTP endpoints for MCP communication
   - Implements CORS for cross-origin requests
   - Health check endpoint for monitoring

3. **Dashboard UI** (`src/pr-dashboard.ts`, `pr-dashboard.html`)
   - Interactive web interface for viewing and managing PRs
   - Connects to MCP server using the MCP App SDK
   - Real-time filtering and sorting
   - Responsive design with GitHub-style UI

## Technologies Used

- **Model Context Protocol (MCP)** - Protocol for tool and resource communication
- **Express.js** - Web server framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Octokit** - GitHub REST API client
- **Node.js 24** - JavaScript runtime

## Security

- Never commit your `.env` file or expose your GitHub token
- The GitHub token should have minimal required permissions
- Use environment variables for all sensitive configuration
- The application includes CORS support for secure cross-origin requests

## Troubleshooting

### "GITHUB_TOKEN environment variable is required"
Make sure you have created a `.env` file with your GitHub Personal Access Token.

### Port already in use
Change the PORT in your `.env` file to a different port number.

### Build errors
Make sure you're using Node.js 24 or higher:
```bash
node --version  # Should show v24.x.x or higher
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Author

Ajay Chinthapalli

## Links

- [Repository](https://github.com/ajaychinthapalli/github-pr-review-dashboard-mcp-app)
- [Issues](https://github.com/ajaychinthapalli/github-pr-review-dashboard-mcp-app/issues)
- [Model Context Protocol](https://modelcontextprotocol.io/)

