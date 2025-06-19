# Database AI Assistant

A modern React application that connects to user databases (PostgreSQL, MongoDB, MySQL) and allows data analysis and modification through an AI assistant.

## Features

- **Firebase Authentication**: Secure Google login
- **Multi-Database Support**: PostgreSQL, MySQL, and MongoDB connections
- **AI-Powered Queries**: Natural language database querying
- **Dynamic Forms**: Auto-generated forms based on database schema
- **AI Form Assistance**: Intelligent form value suggestions
- **Responsive Design**: Dark mode interface optimized for all devices
- **Real-time Updates**: Live data manipulation and viewing

## Setup

### Prerequisites

- Node.js 18+
- Firebase project with Google authentication enabled
- Backend API server (separate repository)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd database-ai-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Google Authentication
   - Copy your Firebase config to `src/config/firebase.ts`

4. Set up environment variables:
```bash
cp .env.example .env
```

Add your Firebase configuration and API URL to the `.env` file.

5. Start the development server:
```bash
npm run dev
```

## Architecture

### Components Structure

- **Auth Components**: Login and authentication handling
- **Layout Components**: TopNav, Sidebar, and main dashboard layout
- **Database Components**: Connection forms and table viewers
- **AI Components**: Chat interface and query processing
- **Form Components**: Dynamic form generation and data insertion
- **UI Components**: Reusable components like LoadingSpinner

### Context Providers

- **AuthContext**: Manages user authentication state
- **DatabaseContext**: Handles database connections and data state

### Services

- **API Service**: Centralized API communication with error handling
- **Firebase Config**: Authentication configuration

## Usage

1. **Login**: Sign in with your Google account
2. **Connect Database**: Enter your database credentials
3. **Browse Tables**: View available tables in the sidebar
4. **Analyze Data**: Select a table to view schema and data
5. **Ask Questions**: Use natural language to query your data
6. **Add Data**: Use the dynamic form or AI assistance to insert new records

## Development

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Firebase** for authentication
- **Lucide React** for icons
- **React Hot Toast** for notifications
- **Vite** for development and building

## Security

- Credentials are securely transmitted to the backend
- Firebase handles authentication security
- No sensitive data is stored in localStorage
- All API calls are made through secure HTTPS

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details