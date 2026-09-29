# InstaPay Payment Gateway Dashboard

A production-ready payment gateway management system for InstaPay merchants.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/thomzaky2-debug/payment_gateway.git
cd payment_gateway

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔐 Authentication

The dashboard includes a secure login system with:
- Email and password validation
- Brute-force protection (5 attempts → 15-minute lockout)
- Session management
- 256-bit SSL encryption indicators

**Note:** This is a frontend application. In production, connect it to your backend authentication API.

## 📊 Features

### Dashboard Overview
- Real-time revenue statistics
- Interactive transaction charts
- Recent payment activity
- Detector status monitoring

### Transaction Management
- View all transactions with filtering and search
- Sort by amount or date
- Export to CSV
- Detailed transaction view with match confidence scores

### Manual Review Queue
- Review payments that couldn't be auto-matched
- Compare expected vs detected payment details
- Confirm or reject payments with audit trail
- Add review notes

### Detector Health
- Monitor Android detector device status
- View heartbeat history
- Device information and configuration
- APK setup guide

### Developer Portal
- API key management (view/hide/regenerate)
- Webhook configuration and testing
- API documentation
- Code examples

### Audit Log
- Track all system events
- Filter by category (auth, transaction, security, webhook, settings)
- Export logs to CSV
- Security monitoring dashboard

### Security Settings
- Two-factor authentication
- Session timeout configuration
- API rate limiting
- Active session management
- IP whitelist management

### Account Settings
- Profile information
- Business details
- Notification preferences
- Payout configuration

## 🛠️ Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **Lucide React** - Icons
- **Inline styles** - Critical UI rendering

## 📦 Project Structure

```
src/
├── App.tsx                 # Main application component
├── main.tsx               # Application entry point
├── index.css              # Global styles and animations
├── components/
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── Topbar.tsx         # Top header bar
│   ├── MobileNav.tsx      # Mobile navigation drawer
│   ├── Toast.tsx          # Toast notification system
│   └── ConfirmDialog.tsx  # Confirmation dialogs
└── pages/
    ├── LoginPage.tsx      # Authentication page
    ├── OverviewPage.tsx   # Dashboard overview
    ├── TransactionsPage.tsx # Transaction management
    ├── ReviewPage.tsx     # Manual review queue
    ├── DetectorPage.tsx   # Detector health monitoring
    ├── DevelopersPage.tsx # Developer portal
    ├── AuditLogPage.tsx   # Audit log viewer
    ├── SecurityPage.tsx   # Security settings
    └── SettingsPage.tsx   # Account settings
```

## 🔧 Configuration

### API Integration

To connect to a real backend:

1. **Authentication** - Update `LoginPage.tsx` to call your auth API
2. **Transactions** - Update `TransactionsPage.tsx` to fetch from your API
3. **Webhooks** - Configure webhook endpoints in `DevelopersPage.tsx`
4. **Detector** - Connect to your detector device API

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=https://api.yourdomain.com
VITE_WEBHOOK_URL=https://yourdomain.com/api/webhooks
```

## 🎨 Customization

### Branding

Update the logo and colors in:
- `src/components/Sidebar.tsx` - Logo and brand name
- `src/components/Topbar.tsx` - Header branding
- `src/pages/LoginPage.tsx` - Login page branding

### Theme Colors

Main colors are defined inline throughout components:
- Primary: `#2563eb` (Blue)
- Success: `#059669` (Green)
- Warning: `#d97706` (Amber)
- Danger: `#dc2626` (Red)

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages

```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"

# Deploy
npm run deploy
```

## 🔒 Security Considerations

For production deployment:

1. **Backend Authentication** - Implement real JWT/OAuth authentication
2. **API Keys** - Store securely, never expose in frontend
3. **HTTPS** - Always use HTTPS in production
4. **CORS** - Configure proper CORS policies
5. **Rate Limiting** - Implement server-side rate limiting
6. **Input Validation** - Validate all inputs on backend
7. **Audit Logging** - Log all sensitive operations
8. **Session Management** - Implement secure session handling

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software for InstaPay merchants.

## 🆘 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/thomzaky2-debug/payment_gateway/issues)
- Email: support@instapay-gateway.com

## 📝 Changelog

### v2.0.0 (Current)
- ✅ Complete UI overhaul with modern design
- ✅ All features fully functional
- ✅ Security enhancements (2FA, IP whitelist, session management)
- ✅ Audit logging system
- ✅ Responsive design for all devices
- ✅ Toast notification system
- ✅ Confirmation dialogs for destructive actions
- ✅ CSV export functionality
- ✅ Real-time detector monitoring
- ✅ Developer portal with API documentation

---

**Built with ❤️ for InstaPay Merchants**
